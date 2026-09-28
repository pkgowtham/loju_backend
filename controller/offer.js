import Offer from "../model/offer.js";
import Company from "../model/company.js";
import StudentWithOffer from "../model/studentWithOffer.js";
import Student from "../model/student.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import Notification from "../model/notification.js";
import NotificationSetting from "../model/notificationSetting.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

export const create = asyncWrapper(async (req, res) => {
  const { dp, ...body } = await handleMultipartUpload(
    req,
    {
      maxFileCount: 1,
      maxFileSize: 20 * 1024 * 1024,
    },
    "offer"
  );
  const { universityId } = req.auth?.details;
  if (!universityId) throw new CustomError("University ID missing", 400);
  body.universityId = universityId.toString();

  const company = await Company.findById(body.company);
  if (!company) throw new CustomError("Company not found", 404);
  body.category = company.category;

  if (dp?.length) body.dpUrl = dp[0];

  await validateCreateBody(Offer, body);

  const offer = await Offer.create(body);
  // 6. Notification subsystem
  try {
    // Get all active students in this university
    const students = await Student.aggregate([
      {
        $match: {
          // universityId: universityId,
          isBlocked: false,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { studentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$studentId", "$details"],
                },
              },
            },
          ],
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          user: 1,
        },
      },
    ]);

    const notificationPromises = [];
    const pushMessages = [];

    for (const student of students) {
      const settings = await NotificationSetting.findOne({
        studentId: student._id,
      });

      if (!settings) {
        continue;
      }

      // Create in-app notification
      notificationPromises.push(
        Notification.create({
          studentId: student._id,
          senderId: req.auth.details._id,
          type: "OFFER",
          messageContent: `New ${company.name} offer available: ${body.name}`,
          offerId: offer._id,
          offerUrl: `/(offers)/view`,
          isRead: false,
        })
      );

      // Prepare push notification if enabled
      if (settings.offer !== false && student.user.notificationToken) {
        pushMessages.push({
          to: student.user.notificationToken,
          sound: "default",
          title: "New Offer Available",
          body: `${company.name}: ${body.name}-${body.description}`,
          data: {
            offerId: offer._id.toString(),
            type: "OFFER",
            action: "OFFER_NOTIFICATION",
            url: `/(offers)/view`,
          },
        });
      }
    }

    // Send push notifications in chunks
    const chunks = expo.chunkPushNotifications(pushMessages);
    const pushResults = await Promise.all(
      chunks.map(async (chunk, index) => {
        try {
          return await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error(`❌ Push notification chunk failed:`, error);
          return [];
        }
      })
    );

    // Save all notifications
    await Promise.all(notificationPromises);
  } catch (notificationError) {
    console.error("❌ Notification subsystem failed:", notificationError);
    // Don't fail the whole request if notifications fail
  }

  // 7. Send response
  res.status(201).json({
    success: true,
    data: offer,
    message: "Offer created and notifications sent",
  });
});

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const offer = await Offer.findById(id);
  if (!offer) throw new CustomError("Offer not found", 404);

  const { dp, ...body } = await handleMultipartUpload(
    req,
    {
      maxFileCount: 1,
      maxFileSize: 20 * 1024 * 1024,
    },
    "offer"
  );

  if (body.company) {
    const company = await Company.findById(body.company);
    if (!company) throw new CustomError("Company not found", 404);
    body.category = company.category;
  }

  if (dp?.length) {
    if (offer.dpUrl) await deleteS3FileByUrl([offer.dpUrl]);
    body.dpUrl = dp[0];
  }

  await validateUpdateBody(Offer, body);
  const updated = await Offer.findByIdAndUpdate(id, body, { new: true });
  res.status(200).json({ success: true, data: updated });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const offer = await Offer.findById(id);
  if (!offer) throw new CustomError("Offer not found", 404);

  if (offer.dpUrl) await deleteS3FileByUrl([offer.dpUrl]);
  await StudentWithOffer.deleteMany({ offerId: id });
  await offer.deleteOne();

  res.status(200).json({ success: true, message: "Offer deleted" });
});

export const getList = asyncWrapper(async (req, res) => {
  const {
    search,
    category,
    companyId,
    page = 1,
    limit = 10,
    latest,
  } = req.query;

  const studentId = req.auth.details._id;

  const query = {};
  if (search) query.name = { $regex: search, $options: "i" };
  if (category) query.category = category;
  if (companyId) query.company = companyId;
  if (latest === "true") query.expiryDate = { $gte: new Date() };

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);

  // 🔢 Step 1: Get total offers
  const count = await Offer.countDocuments(query);

  // 🧲 Step 2: Get offers
  const offers = await Offer.find(query)
    .populate("company")
    .skip((pageNum - 1) * pageLimit)
    .limit(pageLimit)
    .sort({ startingDate: 1 });

  // 🧠 Step 3: Get redeemed offer IDs for this student
  const offerIds = offers.map((o) => o._id);
  const redeemed = await StudentWithOffer.find({
    studentId,
    offerId: { $in: offerIds },
  });

  const redeemedMap = new Set(redeemed.map((r) => r.offerId.toString()));

  // 🔁 Step 4: Add redeemed boolean to each offer
  const enrichedOffers = offers.map((offer) => {
    const offerObj = offer.toObject();
    return {
      ...offerObj,
      redeemed: redeemedMap.has(offer._id.toString()),
    };
  });

  // 📤 Step 5: Send response
  res.status(200).json({
    success: true,
    totalCount: count,
    data: enrichedOffers,
  });
});

// 🎯 Get Offers by University (Maintainer only)
export const getByUniversityId = asyncWrapper(async (req, res) => {
  const {
    search,
    category,
    companyId,
    page = 1,
    limit = 10,
    latest,
  } = req.query;
  const query = {};

  const { universityId } = req.auth?.details;
  if (!universityId) throw new CustomError("University ID not found", 400);

  if (universityId) query.universityId = universityId;
  if (search) query.name = { $regex: search, $options: "i" };
  if (category) query.category = category;
  if (companyId) query.company = companyId;

  if (latest === "true") {
    query.expiryDate = { $gte: new Date() };
  }

  const count = await Offer.countDocuments(query);
  const offers = await Offer.find(query)
    .populate("company")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ startingDate: 1 });

  res.status(200).json({
    success: true,
    totalCount: count,
    page: page,
    pageSize: limit,
    data: offers,
  });
});

export const getById = asyncWrapper(async (req, res) => {
  const { offerId } = req.params;

  const offer = await Offer.findById(offerId).populate("company");
  if (!offer) throw new CustomError("Offer not found", 404);

  const students = await StudentWithOffer.find({ offerId }).populate(
    "studentId"
  );
  const list = students.map((s) => ({
    _id: s._id,
    studentId: s.studentId._id,
    firstName: s.studentId.firstName,
    lastName: s.studentId.lastName,
    dp: s.studentId.dp,
    avatar: s.studentId.avatar,
    avatarBg: s.studentId.avatarBg,
    avatarDisplay: s.studentId.avatarDisplay,
    redeemedOn: s.redeemedOn,
  }));

  res.status(200).json({
    success: true,
    data: {
      ...offer.toObject(),
      redeemedCount: list.length,
      redeemedBy: list,
    },
  });
});

export const redeemOffer = asyncWrapper(async (req, res) => {
  const { offerId, studentId } = req.body;
  if (!offerId || !studentId)
    throw new CustomError("offerId and studentId are required", 400);

  const exists = await StudentWithOffer.findOne({ offerId, studentId });
  if (exists) throw new CustomError("Offer already redeemed by student", 400);

  const redeemed = await StudentWithOffer.create({ offerId, studentId });
  res.status(201).json({ success: true, data: redeemed });
});
