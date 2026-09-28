import Post from "../model/post.js";
import Society from "../model/society.js";
import { CustomError } from "../utils/errorHandler.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import StudentWithSociety from "../model/studentWithSociety.js";
import Notification from "../model/notification.js";
import NotificationSetting from "../model/notificationSetting.js";
import User from "../model/user.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

export const create = asyncWrapper(async (req, res) => {
  const { auth } = req;
  const body = await handleMultipartUpload(req, {
    fileLimit: 5,
    folder: "posts",
  });

  const society = await Society.findById(body.societyId);
  if (!society) throw new CustomError("Society not found", 404);

  if (!auth.details.societyAdmin.includes(society._id)) {
    throw new CustomError("Only society admins can create posts", 403);
  }

  const post = await Post.create({
    societyId: body.societyId,
    studentId: auth.details._id,
    description: body.description,
    images: body.images || [],
  });

  // Notification subsystem - errors will be caught by asyncWrapper
  // Get all students who have joined this society
  const societyMembers = await StudentWithSociety.find({
    society: body.societyId,
    allow: true,
  }).populate({
    path: "student",
    match: { isBlocked: false },
  });

  // Get user IDs for these students
  const studentIds = societyMembers
    .filter((member) => member.student)
    .map((member) => member.student._id);

  // Find users associated with these students
  const users = await User.find({
    details: { $in: studentIds },
    detailsModel: "Student",
  }).lean();

  // Create a mapping of student ID to user
  const userMap = new Map();
  users.forEach((user) => {
    userMap.set(user.details.toString(), user);
  });

  // Filter valid members with users
  const validMembers = societyMembers.filter(
    (member) =>
      member.student &&
      !member.student.isBlocked &&
      userMap.has(member.student._id.toString())
  );

  const membersToPush = [];
  const membersToCreateNotification = [];

  for (const member of validMembers) {
    const student = member.student;
    const user = userMap.get(student._id.toString());

    const settings = await NotificationSetting.findOne({
      studentId: student._id,
    });

    if (!settings) {
      continue;
    }

    membersToCreateNotification.push(student);

    if (
      settings.post !== false &&
      user.notificationToken &&
      Expo.isExpoPushToken(user.notificationToken)
    ) {
      membersToPush.push({ student, user });
    }
  }

  // In-app notifications
  const notificationPromises = membersToCreateNotification.map((student) =>
    Notification.create({
      studentId: student._id,
      senderId: auth.details._id,
      type: "POST",
      messageContent: `New post in ${society.name}: ${body.description}`,
      postId: post._id,
      postUrl: ` /(tabs)/home`,
      isRead: false,
    })
  );

  // Push notifications only for those opted-in
  const pushMessages = membersToPush.map(({ user }) => ({
    to: user.notificationToken,
    sound: "default",
    title: "New Society Post",
    body: `New post in ${society.name}: ${body.description}`,
    data: {
      postId: post._id.toString(),
      type: "POST",
      action: "POST_NOTIFICATION",
      url: `/(tabs)/home'`,
    },
    _displayInForeground: true,
  }));

  const chunks = expo.chunkPushNotifications(pushMessages);

  const pushResults = await Promise.all(
    chunks.map(async (chunk) => {
      return await expo.sendPushNotificationsAsync(chunk);
    })
  );

  await Promise.all(notificationPromises);
  res.status(201).json({
    success: true,
    data: post,
    message: "Post created and notifications sent to society members",
  });
});

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { auth } = req;
  const post = await Post.findById(id);
  if (!post) throw new CustomError("Post not found", 404);

  if (!auth.details.societyAdmin.includes(post.societyId)) {
    throw new CustomError("Only society admins can update posts", 403);
  }

  const body = await handleMultipartUpload(req, {
    fileLimit: 5,
    folder: "posts",
  });

  await validateUpdateBody(Post, {
    ...body,
    studentId: auth.details._id.toString(),
  });

  if (body.images?.length) {
    await deleteS3FileByUrl(post.images);
  }

  const updated = await Post.findByIdAndUpdate(id, body, { new: true });
  res.status(200).json({ success: true, data: updated });
});

export const getBySocietyId = asyncWrapper(async (req, res) => {
  const { societyId, page = 1, limit = 10 } = req.query;

  if (!societyId) throw new CustomError("societyId is required", 400);

  const query = { societyId };

  const total = await Post.countDocuments(query);
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate("studentId", "firstName lastName dp")
    .populate("societyId", "name logo _id");

  res.status(200).json({
    success: true,
    data: posts,
    total,
    page: Number(page),
    pageSize: posts.length,
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { auth } = req;

  const post = await Post.findById(id);
  if (!post) throw new CustomError("Post not found", 404);

  const isAdmin =
    auth.role === "MAINTAINER" ||
    auth.details?.societyAdmin?.includes(post.societyId);
  if (!isAdmin)
    throw new CustomError("Not authorized to delete this post", 403);

  // 🧹 Optional: delete associated S3 images
  await deleteS3FileByUrl(post.images);

  await post.deleteOne();
  res.status(200).json({ success: true, message: "Post deleted" });
});
