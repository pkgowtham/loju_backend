import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import Society from "../model/society.js";
import StudentWithSociety from "../model/studentWithSociety.js";
import StudentWithSubcategory from "../model/studentWithSubcategory.js";
import Report from "../model/report.js";
import { deleteS3FileByUrl, handleMultipartUpload } from "../utils/s3Upload.js";
import Student from "../model/student.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import Maintainer from "../model/maintainer.js";
import Post from "../model/post.js";
import NotificationSetting from "../model/notificationSetting.js";
import Notification from "../model/notification.js";
import mongoose from "mongoose"; // needed for mongoose.Types.ObjectId in  getByStudentNotInterest
import { parse } from "csv-parse/sync";
import fetch from "node-fetch";
import ChatGroups from "../model/chatGroups.js";
import axios from "axios";
import { Expo } from "expo-server-sdk";
import Event from "../model/event.js";
import StudentWithEvent from "../model/studentWithEvent.js";
import University from "../model/university.js";
import Category from "../model/category.js";
import Subcategory from "../model/subcategory.js";
const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;
const SENDBIRD_HEADERS = {
  "Api-Token": process.env.SENDBIRD_API_TOKEN,
  "Content-Type": "application/json",
};
const expo = new Expo();

// 🚀 Create Society Controller
export const create = asyncWrapper(async (req, res) => {
  const data = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 2,
    },
    "society"
  );

  const { studentId, logo, banner, activityAdminId, ...rest } = data;

  const { universityId } = req.auth?.details;
  if (!universityId) throw new CustomError("University ID not found", 400);

  // if (!studentId) throw new CustomError("studentId is required", 400);

  if (universityId) rest.universityId = universityId.toString();
  if (logo?.length) rest.logo = logo[0];
  if (banner?.length) rest.banner = banner[0];

  let activityAdmins = activityAdminId;
  if (
    !activityAdmins ||
    (Array.isArray(activityAdmins) && activityAdmins.length === 0)
  ) {
    activityAdmins = [studentId]; // fallback to creator
  } else if (typeof activityAdmins === "string") {
    activityAdmins = activityAdmins.split(",").map((id) => id.trim());
  }

  rest.activityAdminId = activityAdmins;

  await validateCreateBody(Society, rest);

  const society = await Society.create(rest);

  // await Student.findByIdAndUpdate(studentId, {
  //   $addToSet: {
  //     societyAdmin: society._id,
  //   },
  // });
  await Student.updateMany(
    { _id: { $in: rest.activityAdminId } },
    { $addToSet: { societyAdmin: society._id } }
  );

  // ========================
  //  Admin-Only Chat Group
  // ========================

  try {
    const adminStudent = await Student.findById(studentId);
    if (!adminStudent) throw new Error("Admin student not found");

    // Prepare users to create in SendBird
    const usersToCreate = [
      {
        user_id: adminStudent._id.toString(),
        nickname: `${adminStudent.firstName} ${adminStudent.lastName}`,
        profile_url: adminStudent.dp || adminStudent.avatar || "",
      },
    ];

    // Create users in SendBird
    for (const user of usersToCreate) {
      try {
        await axios.post(`${BASE_URL}/users`, user, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
        });
      } catch (err) {
        if (![400201, 400202].includes(err.response?.data?.code)) {
          console.error(
            `SendBird user creation failed for ${user.user_id}:`,
            err.response?.data || err.message
          );
          throw err;
        }
      }
    }

    // Create numbered chat channel
    const chatCount = await ChatGroups.countDocuments({
      societyId: society._id,
    });
    const nextChatNumber = chatCount + 1;
    const channelName = `${society.name} Chat ${nextChatNumber}`;

    const channelData = {
      name: channelName,
      is_distinct: false,
      is_public: false,
      user_ids: usersToCreate.map((u) => u.user_id), // Use the user_ids from usersToCreate
      cover_url: society.logo || society.banner || "",
    };

    const sbResponse = await axios.post(
      `${BASE_URL}/group_channels`,
      channelData,
      { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
    );

    // Store channel in database
    const chat = await ChatGroups.create({
      name: channelName,
      societyId: society._id,
      studentsId: usersToCreate.map((u) => u.user_id), // Use same user references
      channels: sbResponse.data.channel_url,
      memberLimit: 5,
    });

    // Update admin's chat list
    await Student.findByIdAndUpdate(adminStudent._id, {
      $addToSet: { chats: chat._id },
    });
  } catch (channelError) {
    console.error("Channel creation failed:", channelError);
  }

  // 6. Notification subsystem
  try {
    // Get all active students in this university
    const students = await Student.aggregate([
      {
        $match: {
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
          type: "SOCIETY",
          messageContent: `${society.name} is now live. Join and explore.`,
          societyId: society._id,
          societyUrl: `/(society)/followingScreen`,
          isRead: false,
        })
      );

      // Prepare push notification if enabled
      if (settings.society !== false && student.user.notificationToken) {
        pushMessages.push({
          to: student.user.notificationToken,
          sound: "default",
          title: "New Society Created",
          body: `${society.name} is now live. Join and explore.`,
          data: {
            societyId: society._id.toString(),
            type: "SOCIETY",
            action: "SOCIETY_NOTIFICATION",
            url: `/(society)/followingScreen`,
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
  }

  res.status(201).json({
    success: true,
    data: society,
    message: "Society created and notifications sent",
  });
});
// CSV Upload
export const createSocietiesFromCSV = async (req, res, next) => {
  try {
    // 1️⃣ Upload CSV
    const data = await handleMultipartUpload(
      req,
      { maxFileSize: 20 * 1024 * 1024, maxFileCount: 1 },
      "csv-upload"
    );

    if (!data.file?.[0]) {
      return next(new CustomError("No CSV file uploaded", 400, "File Error"));
    }

    // 2️⃣ Fetch CSV
    const fileUrl = data.file[0];
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return next(new CustomError("Failed to fetch CSV from storage", 500));
    }
    const csvData = await response.text();

    // 3️⃣ Parse CSV
    const records = parse(csvData, {
      columns: [
        "name",
        "description",
        "universityName",
        "categoryName",
        "subcategoryName",
        "instagramUrl",
        "type",
        "logo",
        "banner",
        "display",
        "follower-(This For AutoFollower Count `don't put any other value`)",
        "studentAdmin-(optional)",
      ],
      skip_empty_lines: true,
      trim: true,
      from_line: 2,
    });

    if (!records.length) {
      return next(new CustomError("CSV is empty or invalid", 400));
    }

    const errors = [];
    let processedCount = 0;

    for (const [index, record] of records.entries()) {
      try {
        // 🔹 Validate required fields
        if (
          !record.name?.trim() ||
          !record.description?.trim() ||
          !record.universityName?.trim() ||
          !record.categoryName?.trim() ||
          !record.subcategoryName?.trim() ||
          !record.type?.trim() ||
          !record.logo?.trim() ||
          !record.banner?.trim()
        ) {
          throw new CustomError(
            `Missing required fields at row ${index + 2}`,
            400
          );
        }

        // 🔹 Lookup University
        const university = await University.findOne({
          name: record.universityName.trim(),
        });
        if (!university)
          throw new CustomError(
            `University "${record.universityName}" not found (row ${
              index + 2
            })`,
            400
          );

        // 🔹 Lookup Category
        const category = await Category.findOne({
          name: record.categoryName.trim(),
        });
        if (!category)
          throw new CustomError(
            `Category "${record.categoryName}" not found (row ${index + 2})`,
            400
          );

        // 🔹 Lookup Subcategory
        const subcategory = await Subcategory.findOne({
          name: record.subcategoryName.trim(),
          categoryId: category._id,
        });
        if (!subcategory)
          throw new CustomError(
            `Subcategory "${record.subcategoryName}" not found (row ${
              index + 2
            })`,
            400
          );

        // 🔹 Lookup Admin Student (optional)
        let adminId = null;
        if (record.firstName?.trim()) {
          const admin = await Student.findOne({
            firstName: record.firstName.trim(),
          });
          if (admin) {
            adminId = admin._id;
          }
        }

        // 🔹 Create Society
        await Society.create({
          name: record.name.trim(),
          description: record.description.trim(),
          universityId: university._id,
          category: category._id,
          subcategory: subcategory._id,
          instagramUrl: record.instagramUrl?.trim() || "",
          type: record.type.trim(),
          logo: record.logo.trim(),
          banner: record.banner.trim(),
          display:
            record.display === undefined || record.display === ""
              ? true
              : record.display.toLowerCase() === "true",
          follower: record.follower ? parseInt(record.follower, 10) : 0,
          adminId: adminId,
        });

        processedCount++;
      } catch (err) {
        errors.push({ row: index + 2, error: err.message });
      }
    }

    res.status(200).json({
      message: "CSV processed successfully (Societies)",
      processedCount,
      totalRecords: records.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("CSV processing failed:", error);
    next(new CustomError(`Failed to process CSV: ${error.message}`, 500));
  }
};

// 🔄 Update Society Controller
// export const update = asyncWrapper(async (req, res) => {
//   const { id } = req.params;
//   const existing = await Society.findById(id);
//   if (!existing) throw new CustomError("Society not found", 404);

//   const data = await handleMultipartUpload(req, {
//     maxFileSize: 20 * 1024 * 1024,
//     maxFileCount: 2,
//     folder: "society",
//   });

//   const { studentId, logo, banner, ...updates } = data;

//   await validateUpdateBody(Society, updates);

//   // 🖼 Replace logo
//   if (logo?.length) {
//     if (existing.logoUrl) await deleteS3FileByUrl(existing.logoUrl);
//     updates.logoUrl = logo[0];
//   }

//   // 🖼 Replace banner
//   if (banner?.length) {
//     if (existing.bannerUrl) await deleteS3FileByUrl(existing.bannerUrl);
//     updates.bannerUrl = banner[0];
//   }

//   // 👑 Change admin (if provided)
//   if (studentId && studentId !== existing.studentId?.toString()) {
//     await Student.updateMany(
//       { societyAdmin: id },
//       { $pull: { societyAdmin: id } }
//     );
//     await Student.findByIdAndUpdate(studentId, {
//       $addToSet: { societyAdmin: id },
//     });
//   }

//   const updated = await Society.findByIdAndUpdate(id, updates, { new: true });

//   res.status(200).json({ success: true, data: updated });
// });

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const existing = await Society.findById(id);
  if (!existing) throw new CustomError("Society not found", 404);

  const data = await handleMultipartUpload(req, {
    maxFileSize: 20 * 1024 * 1024,
    maxFileCount: 2,
    folder: "society",
  });

  const {
    adminId,
    logo,
    banner,
    activityAdminAdd,
    activityAdminRemove,
    ...updates
  } = data;
  await validateUpdateBody(Society, updates);

  const parseArrayField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
      try {
        // Handle both JSON string and comma-separated values
        if (field.startsWith("[") && field.endsWith("]")) {
          return JSON.parse(field);
        } else if (field.includes(",")) {
          return field
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        } else {
          return [field.trim()];
        }
      } catch (error) {
        console.warn(`Failed to parse ${field} as array:`, error.message);
        return [field]; // Fallback to single item array
      }
    }
    return [];
  };

  const activityAdminAddArray = parseArrayField(activityAdminAdd);
  const activityAdminRemoveArray = parseArrayField(activityAdminRemove);

  // 🖼 Replace logo
  if (logo?.length) {
    if (existing.logo) await deleteS3FileByUrl([existing.logo]);
    updates.logo = logo[0];
  }

  // 🖼 Replace banner
  if (banner?.length) {
    if (existing.banner) await deleteS3FileByUrl([existing.banner]);
    updates.banner = banner[0];
  }

  // 👑 Change admin logic
  if (adminId && adminId !== existing.adminId?.toString()) {
    const oldAdminId = existing.adminId?.toString();
    const newAdminId = adminId.trim();

    // 1. Remove societyAdmin flag from old admin
    await Student.updateMany(
      { societyAdmin: id },
      { $pull: { societyAdmin: id } }
    );

    // 2. Add societyAdmin flag to new admin
    await Student.findByIdAndUpdate(newAdminId, {
      $addToSet: { societyAdmin: id },
    });

    // Get all chat groups for this society
    const chatGroups = await ChatGroups.find({ societyId: id }).lean();
    const allChannelUrls = chatGroups
      .flatMap((group) => group.channels || [])
      .filter(Boolean);

    // Update MongoDB chat groups

    await ChatGroups.updateMany(
      { societyId: id },
      { $pull: { studentsId: oldAdminId } }
    );

    await ChatGroups.updateMany(
      { societyId: id },
      { $addToSet: { studentsId: newAdminId } }
    );

    // Get all chat group IDs for this society
    const chatGroupIds = chatGroups.map((group) => group._id);

    // 3. Remove chat group references from old admin's 'chats' array
    // This removes all society chat groups from the old admin's profile
    await Student.findByIdAndUpdate(oldAdminId, {
      $pull: { chats: { $in: chatGroupIds } },
    });

    // 4. Add chat group references to new admin's 'chats' array
    // This adds all society chat groups to the new admin's profile
    await Student.findByIdAndUpdate(newAdminId, {
      $addToSet: { chats: { $each: chatGroupIds } },
    });

    // Update Sendbird channels if they exist
    if (allChannelUrls.length > 0) {
      const results = await Promise.all(
        allChannelUrls.map(async (channelUrl) => {
          try {
            await axios.post(
              `${BASE_URL}/group_channels/${channelUrl}/invite`,
              { user_ids: [newAdminId] },
              { headers: SENDBIRD_HEADERS }
            );

            await axios.put(
              `${BASE_URL}/group_channels/${channelUrl}/leave`,
              { user_ids: [oldAdminId] },
              { headers: SENDBIRD_HEADERS }
            );

            return { success: true, channelUrl };
          } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error(`❌ Failed to update ${channelUrl}:`, errMsg);
            return { success: false, channelUrl, error: errMsg };
          }
        })
      );

      const failedUpdates = results.filter((r) => !r.success);
      if (failedUpdates.length > 0) {
        console.error(
          `⚠️ Failed to update ${failedUpdates.length}/${allChannelUrls.length} channels`
        );
      }
    }

    updates.adminId = newAdminId;
  }
  // 🔄 Handle activityAdmin add/remove (expects arrays of student IDs)
  if (activityAdminAddArray.length > 0) {
    // 1️⃣ Add society reference to students being added
    await Student.updateMany(
      { _id: { $in: activityAdminAddArray } },
      { $addToSet: { societyAdmin: id } }
    );

    // 2️⃣ Update Society's activityAdminId array
    updates.activityAdminId = [
      ...new Set([
        ...(existing.activityAdminId || []),
        ...activityAdminAddArray.map((s) => s.toString()),
      ]),
    ];
  }

  if (activityAdminRemoveArray.length > 0) {
    // 1️⃣ Remove society reference from students being removed
    await Student.updateMany(
      { _id: { $in: activityAdminRemoveArray } },
      { $pull: { societyAdmin: id } }
    );

    // 2️⃣ Remove student IDs from Society's activityAdminId array
    updates.activityAdminId = (
      updates.activityAdminId ||
      existing.activityAdminId ||
      []
    ).filter((sid) => !activityAdminRemoveArray.includes(sid.toString()));
  }

  const updated = await Society.findByIdAndUpdate(id, updates, { new: true });
  res.status(200).json({ success: true, data: updated });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const society = await Society.findById(id);
  if (!society) throw new CustomError("Society not found", 404);

  if (society.logo) await deleteS3FileByUrl([society.logo]);
  if (society.banner) await deleteS3FileByUrl([society.banner]);

  await StudentWithSociety.deleteMany({ societyId: id });
  await Student.updateMany(
    { societyAdmin: id },
    { $pull: { societyAdmin: id } }
  );

  await society.deleteOne();

  res
    .status(200)
    .json({ success: true, message: "Society and related data deleted" });
});

export const getAll = asyncWrapper(async (req, res) => {
  const { search = "", page = 1, limit = 10 } = req.query;
  const universityId = req.auth.details.university;

  const matchQuery = { universityId: universityId };

  if (search.trim()) {
    matchQuery.name = { $regex: search.trim(), $options: "i" };
  }

  const total = await Society.countDocuments(matchQuery);
  const societies = await Society.find(matchQuery)
    .sort({ name: 1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: societies,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

export const getBySubcategories = asyncWrapper(async (req, res) => {
  const { subcategoryIds } = req.body;
  const universityId = req.auth.details.university;

  if (!Array.isArray(subcategoryIds)) {
    throw new CustomError("subcategoryIds must be an array", 400);
  }

  const societies = await Society.find({
    universityId: universityId,
    subcategory: { $in: subcategoryIds },
  }).sort("name");

  res.status(200).json({ success: true, data: societies });
});

export const getByCategory = asyncWrapper(async (req, res) => {
  const { categoryId } = req.params;
  const universityId = req.auth.details.university;

  if (!categoryId) {
    throw new CustomError("categoryId is required", 400);
  }

  const societies = await Society.find({
    universityId: universityId,
    category: categoryId,
  }).sort("name");

  res.status(200).json({ success: true, data: societies });
});

export const getByType = asyncWrapper(async (req, res) => {
  const { type } = req.query;
  const universityId = req.auth.details.university;

  if (!type || !["SPORTS", "TOPICS"].includes(type)) {
    throw new CustomError("Valid type is required", 400);
  }

  const societies = await Society.find({
    universityId: universityId,
    type,
  }).sort("name");

  res.status(200).json({ success: true, data: societies });
});

// 🚀 Society controller: getByUniversityId with search, pagination, and filters
export const getByUniversityId = asyncWrapper(async (req, res) => {
  // 🛡️ Only maintainers allowed
  if (req.auth.role !== "MAINTAINER") {
    throw new CustomError("Only maintainers can access this", 403);
  }
  const maintainer = await Maintainer.findById(req.auth.details._id);
  if (!maintainer) throw new CustomError("Maintainer not found", 404);

  const {
    page = 1,
    pageSize = 10,
    search = "",
    category,
    subcategory,
    admin, // studentId
    type,
    display,
  } = req.query;

  const query = {
    universityId: maintainer.universityId,
  };

  // 🔍 Optional filters
  if (search) query.name = { $regex: search, $options: "i" };
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (admin) query.admin = admin;
  if (type) query.type = type;
  if (display !== undefined) query.display = display === "true";

  // 📊 Pagination setup
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const limit = parseInt(pageSize);

  const total = await Society.countDocuments(query);
  const societies = await Society.find(query)
    .populate("category")
    .populate("subcategory")
    .populate("universityId")
    .populate("adminId")
    .populate({
      path: "activityAdminId",
      select: "_id firstName lastName",
    })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const societiesWithEvents = await Promise.all(
    societies.map(async (society) => {
      const totalEvents = await Event.countDocuments({ society: society._id });
      return {
        ...society.toObject(),
        totalEvents,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: societiesWithEvents,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
});

// export const getByStudentNotInterest = asyncWrapper(async (req, res) => {
//   const studentId = req.auth.details._id;
//   const universityId = req.auth.details.university;

//   if (!studentId || !universityId)
//     throw new CustomError("Student or university info missing", 400);

//   // 🎯 Find all societyIds already joined by the student
//   const joinedSocieties = await StudentWithSociety.find({
//     student: studentId,
//   }).select("society");

//   const joinedSocietyIds = joinedSocieties.map(
//     (j) => new mongoose.Types.ObjectId(j.society)
//   );

//   // 🎯 Get all societies from same university that are NOT already joined
//   const societies = await Society.find({
//     universityId: universityId,
//     _id: { $nin: joinedSocietyIds },
//   }).sort("name");

//   res.status(200).json({ success: true, data: societies });
// });

export const getByStudentNotInterest = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const universityId = req.auth.details.university;

  if (!studentId || !universityId)
    throw new CustomError("Student or university info missing", 400);

  // 🎯 Find all subcategories (interests) of the student
  const studentInterests = await StudentWithSubcategory.find({
    studentId: studentId,
  }).select("subcategoryId");

  const interestIds = studentInterests.map(
    (i) => new mongoose.Types.ObjectId(i.subcategoryId)
  );

  const joinedSocieties = await StudentWithSociety.find({
    student: studentId,
  }).select("society");

  const joinedSocietyIds = joinedSocieties.map(
    (j) => new mongoose.Types.ObjectId(j.society)
  );

  if (interestIds.length === 0) {
    const societies = await Society.find({
      universityId: universityId,
      _id: { $nin: joinedSocietyIds }, // only societies matching student's interests
    }).sort("name");
    return res.status(200).json({ success: true, data: societies });
  }

  // 🎯 Get societies in the same university that match student's interests
  const societies = await Society.find({
    universityId: universityId,
    subcategory: { $in: interestIds },
    _id: { $nin: joinedSocietyIds }, // only societies matching student's interests
  }).sort("name");

  res.status(200).json({ success: true, data: societies });
});

export const getByStudentJoined = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const universityId = req.auth.details.university;

  if (!studentId || !universityId)
    throw new CustomError("Student or university info missing", 400);

  // 🎯 Find all societyIds already joined by the student
  const joinedSocieties = await StudentWithSociety.find({
    student: studentId,
  }).select("society");

  const joinedSocietyIds = joinedSocieties.map(
    (j) => new mongoose.Types.ObjectId(j.society)
  );

  // 🎯 Get all societies from same university that are NOT already joined
  const societies = await Society.find({
    universityId: universityId,
    _id: { $in: joinedSocietyIds },
  }).sort("name");

  res.status(200).json({ success: true, data: societies });
});

export const getByStudentInterest = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const universityId = req.auth.details.university;

  if (!studentId) throw new CustomError("studentId is required", 400);

  const subcategoryInterests = await StudentWithSubcategory.find({ studentId });
  console.log("subcategoryInterests", subcategoryInterests);

  const subcategoryIds = subcategoryInterests.map((s) =>
    s.subcategoryId.toString()
  );

  const societies = await Society.find({
    subcategory: { $in: subcategoryIds },
    universityId: universityId,
  }).sort("name");
  console.log("societies", societies);

  res.status(200).json({ success: true, data: societies });
});

export const getBySocietyId = asyncWrapper(async (req, res) => {
  const student = req.auth.details._id;
  const { societyId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNum - 1) * pageLimit;

  // 🧠 Step 1: check society ID
  if (!societyId) {
    throw new CustomError("Society Id not found", 400);
  }

  // 🔍 Get society
  const society = await Society.findById(societyId);
  if (!society) throw new CustomError("Society not found", 404);

  // 🧠 Check if student joined
  const isJoined = await StudentWithSociety.exists({
    student: student,
    society: societyId,
  });

  // 🔢 Count total joined
  const totalJoined = await StudentWithSociety.countDocuments({
    society: societyId,
  });

  // 🔢 Step 2: Count total posts and events
  const [postCount, eventCount] = await Promise.all([
    Post.countDocuments({ societyId }),
    Event.countDocuments({ society: societyId }),
  ]);

  const total = postCount + eventCount;

  // 📊 Step 3: Calculate weightage
  const postRatio = postCount / total;
  const eventRatio = eventCount / total;

  const postLimit = Math.round(pageLimit * postRatio);
  const eventLimit = pageLimit - postLimit;

  const postSkip = Math.round(skip * postRatio);
  const eventSkip = skip - postSkip;

  // 📥 Step 4: Fetch data with weighted limit & skip
  const [posts, events] = await Promise.all([
    Post.find({ societyId })
      .populate("societyId", "name logo _id")
      .sort({ createdAt: -1 })
      .skip(postSkip)
      .limit(postLimit),
    Event.find({ society: societyId })
      .populate("society", "name logo _id")
      .sort({ createdAt: -1 })
      .skip(eventSkip)
      .limit(eventLimit),
  ]);

  // 🧠 Step 4: Get student-event relations
  const eventIds = events.map((e) => e._id);
  const joinedEvents = await StudentWithEvent.find({
    studentId: req.auth.details._id,
    eventId: { $in: eventIds },
  });

  // 🗺️ Step 5: Map relations
  const eventMap = {};
  joinedEvents.forEach((e) => {
    eventMap[e.eventId.toString()] = {
      joined: true,
      going: e.going,
    };
  });

  // 🔁 Step 6: Append to events
  const enrichedEvents = events.map((e) => {
    const eventData = e.toObject();
    const eventStatus = eventMap[e._id.toString()] || {
      joined: false,
      going: false,
    };
    return {
      ...eventData,
      joined: eventStatus.joined,
      going: eventStatus.going,
    };
  });
  // 🌀 Step 5: Combine with type field
  const combined = [
    ...posts.map((p) => ({ ...p.toObject(), type: "POST" })),
    ...enrichedEvents.map((e) => ({ ...e, type: "EVENT" })),
  ];

  // 🕒 Step 6: Sort by latest
  combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({
    success: true,
    page: pageNum,
    pageSize: combined.length,
    total,
    data: {
      society,
      isJoined: !!isJoined,
      totalJoined,
      feed: combined,
    },
  });
});

export const joinSocieties = asyncWrapper(async (req, res) => {
  const { studentId, societyIds } = req.body;
  if (!studentId || !Array.isArray(societyIds))
    throw new CustomError("Invalid input", 400);

  const created = [];
  for (const societyId of societyIds) {
    const exists = await StudentWithSociety.findOne({
      student: studentId,
      society: societyId,
    });
    if (exists)
      throw new CustomError("Student already joined this society", 400);

    const doc = await StudentWithSociety.create({
      student: studentId,
      society: societyId,
      allow: true,
    });
    await Society.findByIdAndUpdate(societyId, { $inc: { count: 1 } });
    created.push(doc);
  }

  res.status(201).json({ success: true, data: created });
});

// 🚀 Controller: Leave Society with Admin Check
export const leaveSociety = asyncWrapper(async (req, res) => {
  const { studentId, societyId, reason, note } = req.body;

  // Validation
  if (!studentId || !societyId) {
    throw new CustomError(
      "Student ID, Society ID, and reason are required",
      400
    );
  }

  // Data retrieval
  const [student, society] = await Promise.all([
    Student.findById(studentId).lean(),
    Society.findById(societyId).lean(),
  ]);

  if (!student) throw new CustomError("Student not found", 404);
  if (!society) throw new CustomError("Society not found", 404);
  if (student.societyAdmin?.includes(societyId)) {
    throw new CustomError("Admin cannot leave their own society", 403);
  }

  // Membership check
  const membership = await StudentWithSociety.findOne({
    student: studentId,
    society: societyId,
  });

  if (!membership) {
    throw new CustomError("Student is not a member of this society", 400);
  }

  // Chat group check
  const chatGroups = await ChatGroups.find({
    societyId,
    studentsId: { $in: [studentId] },
  });

  if (reason) {
    await Report.create({
      studentId,
      societyId,
      reason,
      note,
      type: "SOCIETY",
    });
  }

  await StudentWithSociety.findOneAndDelete({
    student: studentId,
    society: societyId,
  });

  // Update society count
  const societyUpdate = { $inc: { count: -1 } };
  if (society.count === undefined) societyUpdate.$set = { count: 0 };
  const updatedSociety = await Society.findByIdAndUpdate(
    societyId,
    societyUpdate,
    { new: true }
  );

  // Update student's societies
  const studentUpdate = { $pull: { societies: societyId } };
  if (!student.societies) studentUpdate.$set = { societies: [] };

  // / Also remove all society-related chat groups from student's chats array
  const chatGroupIds = chatGroups.map((group) => group._id);
  studentUpdate.$pull = {
    ...studentUpdate.$pull,
    chats: { $in: chatGroupIds },
  };

  const updatedStudent = await Student.findByIdAndUpdate(
    studentId,
    studentUpdate,
    { new: true }
  );

  // Chat group and SendBird cleanup
  if (chatGroups.length > 0) {
    await Promise.all(
      chatGroups.map(async (group) => {
        // Remove student from chat group
        const updatedGroup = await ChatGroups.findByIdAndUpdate(
          group._id,
          { $pull: { studentsId: studentId } },
          { new: true }
        );

        // Check if group should be deleted
        const isAdmin = society.adminId?.toString();
        const remainingMembers = updatedGroup.studentsId.map((id) =>
          id.toString()
        );
        const shouldDeleteGroup =
          remainingMembers.length === 0 ||
          (remainingMembers.length === 1 && remainingMembers[0] === isAdmin);

        // Handle SendBird channel
        if (group.channels?.startsWith("sendbird_group_channel_")) {
          await axios.put(
            `${BASE_URL}/group_channels/${group.channels}/leave`,
            { user_ids: [studentId] },
            { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
          );

          if (shouldDeleteGroup) {
            await axios.delete(`${BASE_URL}/group_channels/${group.channels}`, {
              headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
            });
          }
        }

        // Delete MongoDB group if needed
        if (shouldDeleteGroup) {
          await ChatGroups.findByIdAndDelete(group._id);
        }
      })
    );
  }

  // Success response
  res.status(200).json({
    success: true,
    message: "Successfully left society",
    data: {
      societyCount: updatedSociety.count,
      remainingSocieties: updatedStudent.societies?.length || 0,
      chatGroupsProcessed: chatGroups.length,
      sendbirdChannelsProcessed: chatGroups.filter((g) => g.channels).length,
    },
  });
});

export const makeAdmin = asyncWrapper(async (req, res) => {
  const { studentId, societyId } = req.query;
  const exists = await StudentWithSociety.findOne({ studentId, societyId });
  if (!exists)
    throw new CustomError("Student is not following the society", 400);
  await Student.findByIdAndUpdate(studentId, { isAdmin: true });
  res.status(200).json({ success: true, message: "Student promoted to admin" });
});

export const removeAdmin = asyncWrapper(async (req, res) => {
  const { studentId, societyId } = req.query;
  const student = await Student.findById(studentId);
  if (!student?.isAdmin) throw new CustomError("Student is not an admin", 400);
  await Student.findByIdAndUpdate(studentId, { isAdmin: false });
  res
    .status(200)
    .json({ success: true, message: "Student demoted from admin" });
});
