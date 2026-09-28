import Notification from "../model/notification.js";
import NotificationSetting from "../model/notificationSetting.js";
import Student from "../model/student.js";
import User from "../model/user.js";
import ChatGroups from "../model/chatGroups.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { Expo } from "expo-server-sdk";
const expo = new Expo();

// ✅ 1. getById - GetBy  list of notification by student
export const getById = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  if (!studentId) {
    throw new CustomError("studentId is required", 400);
  }
  const notifications = await Notification.find({ studentId }).populate({
    path: "studentId",
    select: "dp avatar avatarBg avatarDisplay",
    model: "Student",
  })
  .populate({
      path: "senderId",
      select: "dp avatar avatarBg avatarDisplay",
      model: "Student",
    });
  if (!notifications || notifications.length === 0) {
    throw new CustomError("No notifications found for the student", 404);
  }
  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications,
  });
});

// ✅ 2. destroy  delete single notification
export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    throw new CustomError("Notification not found", 404);
  }

  await notification.deleteOne();

  res.status(200).json({
    success: true,
    message: "Notification deleted successfully",
  });
});
// ✅ 3. send notification for group student
export const create = asyncWrapper(async (req, res) => {
  const { groupId, payload } = req.body;
  const { auth } = req;

  // Validation
  if (!groupId || !payload?.message) {
    throw new CustomError(400, "Missing required fields (groupId and message)");
  }

  // 1. First get the chat group with student IDs
  const chatGroup = await ChatGroups.findById(groupId);

  if (!chatGroup) {
    throw new CustomError(404, "Chat group not found");
  }

  // 2. Find all users who have these students as their details
  const users = await User.find({
    details: { $in: chatGroup.studentsId },
    detailsModel: "Student",
    notificationToken: { $exists: true, $ne: null },
  }).select("notificationToken details");

  // 3. Exclude the sender (current user)
  const recipientUsers = users.filter(
    (user) => user._id.toString() !== auth._id.toString()
  );

  if (recipientUsers.length === 0) {
    return res.status(200).json({
      success: true,
      message:
        "No recipients with valid notification tokens (excluding sender)",
      data: {
        groupId,
        groupName: chatGroup.name,
        totalStudents: chatGroup.studentsId.length,
        studentsWithTokens: 0,
      },
    });
  }

  // 4. Process notifications
  const notificationResults = await Promise.all(
    recipientUsers.map(async (user) => {
      const studentId = user.details; // This is the Student _id
      const notificationToken = user.notificationToken;

      // Check notification settings
      const notificationSetting = await NotificationSetting.findOne({
        studentId: studentId,
      });

      if (!notificationSetting?.message) {
        return {
          studentId,
          status: "skipped",
          reason: "Notifications disabled",
        };
      }

      // Create notification record
      const notification = await Notification.create({
        studentId: studentId,
        senderId: auth.details._id,
        type: "MESSAGE",
        messageContent: payload.message,
        messageUrl: payload.url || null,
        groupId: groupId,
      });

      // Prepare push notification
      const pushMessage = {
        to: notificationToken,
        sound: "default",
        title: `New Message in ${chatGroup.name}`,
        body: payload.message,
        data: {
          notificationId: notification._id.toString(),
          type: "MESSAGE",
          groupId: groupId.toString(),
          url: payload.url || null,
        },
      };

      await expo.sendPushNotificationsAsync([pushMessage]);
      return {
        studentId,
        status: "sent",
        notificationId: notification._id,
      };
    })
  );

  // Successful response
  return res.status(201).json({
    success: true,
    message: `Notifications processed for ${
      notificationResults.filter((r) => r.status === "sent").length
    } of ${recipientUsers.length} users (excluding sender)`,
    data: {
      groupId,
      groupName: chatGroup.name,
      totalStudents: chatGroup.studentsId.length,
      studentsWithTokens: recipientUsers.length,
      notifiedStudents: notificationResults.filter((r) => r.status === "sent")
        .length,
      skippedStudents: notificationResults.filter((r) => r.status === "skipped")
        .length,
      failedStudents: notificationResults.filter((r) => r.status === "failed")
        .length,
      results: notificationResults,
    },
  });
});
// ✅ 4.  delete all notification for student
export const clearUpNotification = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;

  const notifications = await Notification.find({ studentId });

  if (notifications.length === 0) {
    throw new CustomError("No notifications found for this student", 404);
  }

  await Notification.deleteMany({ studentId });

  res.status(200).json({
    success: true,
    message: "All notifications for the student have been deleted",
  });
});
