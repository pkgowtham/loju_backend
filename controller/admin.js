import Admin from "../model/admin.js";
import User from "../model/user.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { isStrongPassword } from "../utils/common.js";

// 📇 Create new admin (only other admin can create)
export const create = asyncWrapper(async (req, res) => {
  if (req.auth.role !== "ADMIN")
    throw new CustomError("Only admins can create new admin", 403);

  const body = await handleMultipartUpload(req, { maxFileCount: 1 }, "admin");

  const { email, password } = body;
  const existing = await User.findOne({ email });
  if (existing)
    throw new CustomError("User with this email already exists", 409);

  const hashedPassword = await hashPassword(password);
  if (body.dp?.length) body.dp = body.dp[0];

  const admin = await Admin.create(body);

  await User.create({
    email,
    password: hashedPassword,
    role: "ADMIN",
    details: admin._id,
    detailsModel: "Admin",
  });

  res.status(201).json({ success: true, data: admin });
});

// 🔄 Update admin info
export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const admin = await Admin.findById(id);
  if (!admin) throw new CustomError("Admin not found", 404);

  const user = await User.findOne({ details: id, role: "ADMIN" });
  if (!user) throw new CustomError("User linked to admin not found", 404);

  const body = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 1,
    },
    "admin"
  );

  // ✅ If DP update requested
  if (body.dp?.length) {
    if (admin.dp) await deleteS3FileByUrl([admin.dp]);
    body.dp = body.dp[0];
  }

  // ✅ If email change requested
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

  // ✅ If password change requested
  if (body.password) {
    if (!isStrongPassword(body.password)) {
      throw new CustomError(
        "Password must be at least 8 characters, including one uppercase, one number, and one special character.",
        400
      );
    }
    user.password = await hashPassword(body.password);
  }

  // ✅ Save updates
  await Admin.findByIdAndUpdate(id, body);
  await user.save();

  res
    .status(200)
    .json({ success: true, message: "Admin updated successfully" });
});

// 📃 Get list of all admins
export const getList = asyncWrapper(async (req, res) => {
  const { search = "", page = 1, limit = 10 } = req.query;

  // 🔍 Prepare search regex (case-insensitive)
  const searchRegex = new RegExp(search, "i");

  // 🔎 Find all users with role=ADMIN and matching email if search is present
  const userQuery = { role: "ADMIN" };
  if (search) {
    userQuery.email = { $regex: searchRegex };
  }

  const users = await User.find(userQuery);
  const adminIds = users.map((u) => u.details?.toString()).filter(Boolean);

  // 🧾 Build admin query
  const adminQuery = {};
  if (search) {
    adminQuery.$or = [
      { firstName: { $regex: searchRegex } },
      { lastName: { $regex: searchRegex } },
      { _id: { $in: adminIds } },
    ];
  }

  const total = await Admin.countDocuments(adminQuery);

  // 📄 Fetch paginated admins
  const admins = await Admin.find(adminQuery)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  // 🔄 Prepare userId → email map
  const userMap = {};
  for (const u of users) {
    if (u.details) userMap[u.details.toString()] = u.email;
  }

  // 🧩 Combine admin and email
  const result = admins.map((admin) => ({
    ...admin.toObject(),
    email: userMap[admin._id.toString()] || "",
  }));

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    limit: Number(limit),
    data: result,
  });
});

// ❌ Delete admin (only if more than one admin exists)
export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const currentAdminId = req.auth?._id;

  // console.log("Deleting adminId:", id);
  // console.log("Current adminId (from token):", currentAdminId);

  const admin = await Admin.findById(id);
  if (!admin) throw new CustomError("Admin not found", 404);

  const user = await User.findOne({ details: id, role: "ADMIN" });

  if (user && user._id.toString() === currentAdminId.toString()) {
    throw new CustomError("You cannot delete your own account", 400);
  }

  const totalAdmins = await User.countDocuments({ role: "ADMIN" });
  if (totalAdmins <= 1)
    throw new CustomError("At least one admin must remain", 400);

  if (user) await user.deleteOne();

  if (admin.dp) await deleteS3FileByUrl([admin.dp]);
  await admin.deleteOne();

  res.status(200).json({ success: true, message: "Admin deleted" });
});
