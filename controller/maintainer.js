import Maintainer from "../model/maintainer.js";
import User from "../model/user.js";
import { CustomError } from "../utils/errorHandler.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { isStrongPassword } from "../utils/common.js";

// 👤 Create Maintainer
export const create = asyncWrapper(async (req, res) => {
  const { dp, ...body } = await handleMultipartUpload(
    req,
    { maxFileCount: 1 },
    "maintainers"
  );

  const { email, password } = body;

  if (!email || !password)
    throw new CustomError("Email and password are required", 400);

  const existing = await User.findOne({ email });
  if (existing) throw new CustomError("Email already exists", 409);

  const maintainer = await Maintainer.create({ ...body, dp: dp?.[0] });

  const hashed = await hashPassword(password);
  const user = await User.create({
    email,
    password: hashed,
    role: "MAINTAINER",
    details: maintainer._id,
    detailsModel: "Maintainer",
  });

  res.status(201).json({
    success: true,
    data: { ...maintainer.toObject(), email: user.email },
  });
});

// 🚀 Create multiple maintainers and corresponding users
export const createMultiple = asyncWrapper(async (req, res) => {
  const { maintainersData } = req.body; // should be an array

  if (!Array.isArray(maintainersData) || maintainersData.length === 0) {
    throw new CustomError(
      "Request body must be a non-empty array of maintainers",
      400
    );
  }

  // ✅ Validate required fields for each maintainer
  const missing = maintainersData.filter(
    (m) =>
      !m.firstName || !m.lastName || !m.email || !m.password || !m.universityId
  );
  if (missing.length > 0) {
    throw new CustomError(
      "Each maintainer must include firstName, lastName, email, password, universityId",
      400
    );
  }

  // 🔐 Check for duplicate emails
  const emails = maintainersData.map((m) => m.email);
  const existingUsers = await User.find({ email: { $in: emails } });
  if (existingUsers.length > 0) {
    const existingEmails = existingUsers.map((u) => u.email);
    throw new CustomError(
      `Emails already in use: ${existingEmails.join(", ")}`,
      400
    );
  }

  // 🧂 Hash passwords and prepare data
  const maintainerDocs = [];
  const userDocs = [];

  for (const m of maintainersData) {
    const newMaintainer = await Maintainer.create({
      firstName: m.firstName,
      lastName: m.lastName,
      universityId: m.universityId,
      active: m.active ?? true,
    });

    const hashedPassword = await hashPassword(m.password);
    userDocs.push({
      email: m.email,
      password: hashedPassword,
      role: "MAINTAINER",
      details: newMaintainer._id,
      detailsModel: "Maintainer",
    });

    maintainerDocs.push(newMaintainer.toObject());
  }

  // 💾 Bulk insert users
  await User.insertMany(userDocs);

  res.status(201).json({
    success: true,
    data: maintainerDocs,
    message: `${maintainerDocs.length} maintainers created successfully`,
  });
});

// ✏️ Update Maintainer
export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const maintainer = await Maintainer.findById(id);
  if (!maintainer) throw new CustomError("Maintainer not found", 404);

  const user = await User.findOne({ details: id, detailsModel: "Maintainer" });

  const { dp, ...body } = await handleMultipartUpload(
    req,
    { maxFileCount: 1 },
    "maintainers"
  );

  if (dp?.length) {
    if (maintainer.dp) await deleteS3FileByUrl([maintainer.dp]);
    body.dp = dp[0];
  }

  if (body.email && body.email !== user.email) {
    const exists = await User.findOne({ email: body.email });
    if (exists) throw new CustomError("Email already in use", 409);
    user.email = body.email;
  }
  if (
    body.oldPassword &&
    !(await comparePassword(body.oldPassword, user.password))
  ) {
    throw new CustomError("Current Password is incorrect", 404);
  }

  if (body.password) {
    if (!isStrongPassword(body.password)) {
      throw new CustomError(
        "Password must be at least 8 characters, including one uppercase, one number, and one special character.",
        400
      );
    }
    user.password = await hashPassword(body.password);
  }

  await maintainer.set(body).save();
  await user.save();

  res.status(200).json({ success: true, data: maintainer });
});

// ✅ Get paginated list of maintainers with search & university filter
export const getList = asyncWrapper(async (req, res) => {
  const { search, universityId, active, page = 1, limit = 10 } = req.query;

  const query = {};
  if (universityId) query.universityId = universityId;
  if (active !== undefined) query.active = active === "true";

  if (search) {
    query.$or = [
      { firstName: new RegExp(search, "i") },
      { lastName: new RegExp(search, "i") },
    ];
  }

  const pageInt = parseInt(page);
  const limitInt = parseInt(limit);
  const skip = (pageInt - 1) * limitInt;

  // 🧮 Total count before pagination
  const total = await Maintainer.countDocuments(query);

  // 🧑‍💼 Paginated maintainers
  const maintainers = await Maintainer.find(query)
    .populate("universityId", "name logo _id")
    .sort({ firstName: 1 })
    .skip(skip)
    .limit(limitInt);

  // 📧 Fetch corresponding user emails
  const users = await User.find({
    role: "MAINTAINER",
    details: { $in: maintainers.map((m) => m._id) },
  });

  const emailMap = Object.fromEntries(
    users.map((u) => [u.details.toString(), u.email])
  );

  // 🧾 Combine maintainer info with email
  const data = maintainers.map((m) => ({
    ...m.toObject(),
    email: emailMap[m._id.toString()] || null,
  }));

  res.status(200).json({
    success: true,
    data,
    total,
    page: pageInt,
    pageSize: limitInt,
  });
});

// ❌ Delete Maintainer
export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const maintainer = await Maintainer.findById(id);
  if (!maintainer) throw new CustomError("Maintainer not found", 404);

  const user = await User.findOne({ details: id, detailsModel: "Maintainer" });
  if (!user) throw new CustomError("Associated user not found", 404);

  if (maintainer.dp) await deleteS3FileByUrl([maintainer.dp]);

  await user.deleteOne();
  await maintainer.deleteOne();

  res.status(200).json({ success: true, message: "Maintainer deleted" });
});

// 🚫 Make Maintainer Inactive
export const makeInactive = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const maintainer = await Maintainer.findById(id);
  if (!maintainer) throw new CustomError("Maintainer not found", 404);

  maintainer.active = false;
  await maintainer.save();

  res
    .status(200)
    .json({ success: true, message: "Maintainer marked inactive" });
});
