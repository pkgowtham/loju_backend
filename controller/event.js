import Event from "../model/event.js";
import Student from "../model/student.js";
import StudentWithSociety from "../model/studentWithSociety.js";
import { CustomError } from "../utils/errorHandler.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import Maintainer from "../model/maintainer.js";
import Society from "../model/society.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import { Expo } from "expo-server-sdk";
import NotificationSetting from "../model/notificationSetting.js";
import Notification from "../model/notification.js";
import StudentWithEvent from "../model/studentWithEvent.js";
import User from "../model/user.js";
import ChatGroups from "../model/chatGroups.js";
import axios from "axios";
import dayjs from "dayjs";
const expo = new Expo();

const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;

// 🎉 Create Event

export const create = asyncWrapper(async (req, res) => {
  const { auth } = req;

  const body = await handleMultipartUpload(
    req,
    {
      maxFileCount: 5,
    },
    "event"
  );

  const isAdmin = await Student.findOne({
    _id: auth.details._id,
    societyAdmin: body.society,
  }).lean();

  if (!isAdmin) {
    throw new CustomError("Only society admin can create events", 403);
  }

  if (!body.startingTime || !body.endingTime) {
    throw new CustomError("Start and end time are required", 400);
  }

  body.startingTime = new Date(body.startingTime);
  body.endingTime = new Date(body.endingTime);

  if (body.bannerUrl?.length) {
    body.bannerUrl = body.bannerUrl[0];
  }
  if (body.multimediaUrl?.length) {
    body.multimediaUrl = body.multimediaUrl;
  }

  const event = await Event.create(body);
  // 5. Notification subsystem - Only for students in the society

  // Get all students who have joined this society
  const societyMembers = await StudentWithSociety.find({
    society: body.society,
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
      settings.event !== false &&
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
      type: "EVENT",
      messageContent: `${body.name} has just been added to your society`,
      eventId: event._id,
      eventUrl: `/(dynamic)/event`,
      isRead: false,
    })
  );

  // Push notifications only for those opted-in
  const pushMessages = membersToPush.map(({ user }) => ({
    to: user.notificationToken,
    sound: "default",
    title: "New Society Event",
    body: `${body.name} - has just been added to your society - ${dayjs(
      body.startingTime
    ).format("DD/MM/YYYY")}`,
    data: {
      eventId: event._id.toString(),
      type: "EVENT",
      action: "EVENT_NOTIFICATION",
      url: `/(dynamic)/event`,
    },
    _displayInForeground: true,
  }));

  const chunks = expo.chunkPushNotifications(pushMessages);
  const pushResults = await Promise.all(
    chunks.map((chunk) => expo.sendPushNotificationsAsync(chunk))
  );

  await Promise.all(notificationPromises);

  if (event.sharable) {
    // 1. Find all chat groups for this society
    const chatGroups = await ChatGroups.find({ societyId: event.society });

    if (chatGroups.length > 0) {
      // 2. Prepare the event announcement message
      const eventMessage =
        `🔔 New Event: ${event.name}\n` +
        `🗓️ ${dayjs(event.startingTime).format("DD/MM/YYYY")} \n` +
        `📌 ${event.location || "Location not specified"}`;

      // 3. Send to all groups in parallel (failures are handled by Promise.allSettled)
      const sendResults = await Promise.allSettled(
        chatGroups.map(async (group) => {
          if (!group.channels) {
            return {
              status: "skipped",
              groupId: group._id,
              reason: "No channel URL",
            };
          }

          const payload = {
            message_type: "MESG",
            user_id: auth.details._id,
            message: eventMessage,
            custom_type: "event_announcement",
            data: JSON.stringify({
              eventId: event._id.toString(),
              timestamp: new Date().toISOString(),
              bannerUrl: event.bannerUrl,
              action: "VIEW_EVENT",
              deepLink: `/(dynamic)/event`,
            }),
          };

          const response = await axios.post(
            `${BASE_URL}/group_channels/${group.channels}/messages`,
            payload,
            {
              headers: {
                "Api-Token": process.env.SENDBIRD_API_TOKEN,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          return {
            status: "success",
            groupId: group._id,
            messageId: response.data.message_id,
          };
        })
      );
    }
  }

  res.status(201).json({
    success: true,
    data: event,
    message: "Event created and notifications sent to society members",
  });
});

// ✏️ Update Event
export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { auth } = req;

  const event = await Event.findById(id);
  if (!event) throw new CustomError("Event not found", 404);

  const isAdmin = await Student.findOne({
    _id: auth.details,
    societyAdmin: event.society,
  });

  if (!isAdmin)
    throw new CustomError("Only society admin can update events", 403);

  const body = await handleMultipartUpload(
    req,
    {
      maxFileCount: 5,
    },
    "event"
  );

  // ✅ Parse date fields if sent
  if (body.startingTime) body.startingTime = new Date(body.startingTime);
  if (body.endingTime) body.endingTime = new Date(body.endingTime);

  if (body.bannerUrl?.length) {
    if (event.bannerUrl) await deleteS3FileByUrl([event.bannerUrl]);
    body.bannerUrl = body.bannerUrl[0];
  }

  if (body.multimediaUrl?.length) {
    if (event.multimediaUrl?.length)
      await deleteS3FileByUrl(event.multimediaUrl);
    body.multimediaUrl = body.multimediaUrl;
  }

  const updated = await Event.findByIdAndUpdate(id, body, { new: true });

  // ✅ Get all allowed students linked to the event
  const studentLinks = await StudentWithEvent.find({
    eventId: event._id,
    allow: true,
  }).populate({
    path: "studentId",
    match: { isBlocked: false },
  });

  const notificationPromises = [];
  const pushMessages = [];

  for (const link of studentLinks) {
    const student = link.studentId;
    if (!student) continue;

    // 🔗 Find User linked to Student
    const user = await User.findOne({ details: student._id, role: "STUDENT" });
    if (!user) continue;

    // 📨 Create notification
    notificationPromises.push(
      Notification.create({
        studentId: student._id,
        senderId: auth.details,
        type: "EVENT",
        messageContent: `The event "${updated.name}" has been updated. Check out the latest details!`,
        eventId: updated._id,
        eventUrl: `/(dynamic)/event`,
        isRead: false,
      })
    );

    // 📲 Push notification
    if (user.notificationToken) {
      pushMessages.push({
        to: user.notificationToken,
        sound: "default",
        title: "Event Updated",
        body: `The event "${updated.name}" has been updated.`,
        data: {
          eventId: updated._id.toString(),
          type: "EVENT",
          action: "EVENT_UPDATED",
          url: `/(dynamic)/event`,
        },
      });
    }
  }

  // ✅ Send push notifications in chunks
  const chunks = expo.chunkPushNotifications(pushMessages);
  await Promise.all(
    chunks.map(async (chunk, index) => {
      try {
        const result = await expo.sendPushNotificationsAsync(chunk);
        console.log(`✅ Push chunk ${index + 1} sent, results:`, result);
      } catch (error) {
        console.error(`❌ Push notification chunk ${index + 1} failed:`, error);
      }
    })
  );

  // ✅ Save all notifications
  await Promise.all(notificationPromises);

  res.status(200).json({ success: true, data: updated });
});

// 📥 Get Events by Society
export const getBySocietyId = asyncWrapper(async (req, res) => {
  const { societyId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!societyId) throw new CustomError("societyId is required", 400);

  const query = { society: societyId };

  const total = await Event.countDocuments(query);
  const events = await Event.find(query)
    .populate("society", "name logo _id")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
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

  res.status(200).json({
    success: true,
    data: enrichedEvents,
    total,
    page: Number(page),
    pageSize: events.length,
  });
});

// 📥 Get Events by University
export const getByUniversityId = asyncWrapper(async (req, res) => {
  // 🔐 Role check
  if (req.auth.role !== "MAINTAINER") {
    throw new CustomError("Only maintainers can access this", 403);
  }

  const maintainer = await Maintainer.findById(req.auth.details);
  if (!maintainer) throw new CustomError("Maintainer not found", 404);

  const {
    page = 1,
    pageSize = 10,
    search = "",
    societyId,
    startDate,
    endDate,
  } = req.query;

  // 🔐 Check if provided societyId belongs to the same university
  let allowedSocietyIds = [];

  if (societyId) {
    const society = await Society.findById(societyId);
    if (!society) throw new CustomError("Society not found", 404);
    if (
      society.universityId.toString() !== maintainer.universityId.toString()
    ) {
      throw new CustomError(
        "Not authorized to access events from other universities",
        403
      );
    }
    allowedSocietyIds = [society._id];
  } else {
    // 🎯 Get all societyIds under the same university
    const societies = await Society.find(
      { universityId: maintainer.universityId },
      "_id"
    );
    allowedSocietyIds = societies.map((s) => s._id);
  }

  // 🧠 Build query
  const query = {
    society: { $in: allowedSocietyIds },
  };

  // 🔍 Name search
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  // 📅 Date range filter
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    query.$or = [
      { startDate: { $gte: start, $lte: end } },
      { endDate: { $gte: start, $lte: end } },
    ];
  }

  // 📊 Pagination setup
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const limit = parseInt(pageSize);

  const total = await Event.countDocuments(query);
  const events = await Event.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: events,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
});

export const getByUpcoming = asyncWrapper(async (req, res) => {
  const { filter = "future", type = "ALL" } = req.query;

  const studentId = req.auth.details._id;
  const universityId = req.auth.details.university; // 🎯 University from logged-in student

  if (!studentId || !universityId) {
    throw new CustomError("Student or university info missing", 400);
  }

  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const matchQuery = {};

  if (filter === "today") {
    matchQuery.startingTime = { $lte: endOfDay };
    matchQuery.endingTime = { $gte: startOfDay };
  } else if (filter === "future") {
    matchQuery.startingTime = { $gt: new Date() };
  } else if (filter === "going") {
    const goingEventLinks = await StudentWithEvent.find({
      studentId,
      going: true,
    }).select("eventId");

    const goingEventIds = goingEventLinks.map((e) => e.eventId);
    matchQuery._id = { $in: goingEventIds };
    matchQuery.startingTime = { $gt: new Date() };
  }

  if (type === "ALL") {
    const societies = await Society.find({ universityId: universityId }).select(
      "_id"
    );
    matchQuery.society = { $in: societies.map((s) => s._id) };
  }

  // if (type === "SPORTS" || type === "TOPICS") {
  //   const societies = await Society.find({
  //     type: type,
  //     universityId: universityId,
  //   }).select("_id");
  //   matchQuery.society = { $in: societies.map((s) => s._id) };
  // }

  if (type === "SPORTS" || type === "TOPICS") {
    // Step 1: Get societies of the type in the student's university
    const societiesInUniversity = await Society.find({
      type,
      universityId,
    }).select("_id");
    const universitySocietyIds = societiesInUniversity.map((s) => s._id);

    // Step 2: Cross-check with StudentWithSociety
    const studentSocieties = await StudentWithSociety.find({
      student: studentId,
      allow: true,
      society: { $in: universitySocietyIds }, // only societies the student follows
    }).select("society");

    // Step 3: Apply filter to events
    matchQuery.society = { $in: studentSocieties.map((s) => s.society) };
  }

  const events = await Event.find(matchQuery)
    .populate("society")
    .sort({ startingTime: 1 });
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

  res.status(200).json({
    success: true,
    count: enrichedEvents.length,
    data: enrichedEvents,
  });
});

export const getById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const studentId = req.auth.details._id;

  const event = await Event.findById(id).populate("society");
  if (!event) throw new CustomError("Event not found", 404);

  const studentEventRecord = await StudentWithEvent.findOne({
    studentId,
    eventId: id,
  });

  const isJoined = !!studentEventRecord;
  const isGoing = studentEventRecord?.going ?? false;

  const goingStudents = await StudentWithEvent.find({
    eventId: id,
    going: true,
  }).populate({
    path: "studentId",
    select: "firstName lastName dp avatar avatarBg avatarDisplay",
  });

  const goingList = goingStudents.map((s) => ({
    _id: s.studentId._id,
    firstName: s.studentId.firstName,
    lastName: s.studentId.lastName,
    dp: s.studentId.dp,
    avatar: s.studentId.avatar,
    avatarBg: s.studentId.avatarBg,
    avatarDisplay: s.studentId.avatarDisplay,
  }));

  res.status(200).json({
    success: true,
    data: {
      ...event.toObject(),
      isJoined,
      isGoing,
      goingList,
    },
  });
});

// ❌ Delete Event
/* export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { auth } = req;

  const event = await Event.findById(id);
  if (!event) throw new CustomError("Event not found", 404);

  const isAdmin = await Student.findOne({
    _id: auth.details,
    societyAdmin: event.society,
  });
  const isMaintainer = auth.role === "MAINTAINER";

  if (!isAdmin && !isMaintainer) {
    throw new CustomError("Not authorized to delete event", 403);
  }
  await deleteS3FileByUrl([event.bannerUrl, ...(event.multimediaUrl || [])]);
  await event.deleteOne();

    await StudentWithEvent.deleteMany({ eventId: id });

  res
    .status(200)
    .json({ success: true, message: "Event deleted successfully" });

     res.status(200).json({
    success: true,
    message: "Event deleted successfully. Students have been notified.",
    data: {
      eventId: event._id,
      eventName: event.name,
      notifiedStudents: studentLinks
        .filter(link => link.studentId)
        .map(link => ({
          studentId: link.studentId._id,
          name: `${link.studentId.firstName} ${link.studentId.lastName}`,
        })),
    },
  });
});  */

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { auth } = req;

  const event = await Event.findById(id);
  if (!event) {
    throw new CustomError("Event not found", 404);
  }

  const isAdmin = await Student.findOne({
    _id: auth.details,
    societyAdmin: event.society,
  });
  const isMaintainer = auth.role === "MAINTAINER";

  if (!isAdmin && !isMaintainer) {
    console.log("❌ User not authorized:", auth.details);
    throw new CustomError("Not authorized to delete event", 403);
  }

  // ✅ Get all allowed students linked to the event
  const studentLinks = await StudentWithEvent.find({
    eventId: event._id,
    allow: true,
  }).populate({
    path: "studentId",
    match: { isBlocked: false },
  });

  const notificationPromises = [];
  const pushMessages = [];

  for (const link of studentLinks) {
    const student = link.studentId;
    if (!student) continue;

    // 🔗 Find the User linked to this Student
    const user = await User.findOne({ details: student._id, role: "STUDENT" });
    if (!user) continue;

    notificationPromises.push(
      Notification.create({
        studentId: student._id,
        senderId: auth.details,
        type: "EVENT",
        messageContent: `The event "${event.name}" has been cancelled.`,
        eventId: event._id,
        eventUrl: `/(events)/listScreen`,
        isRead: false,
      })
    );

    // 📲 Push notification
    if (user.notificationToken) {
      pushMessages.push({
        to: user.notificationToken,
        sound: "default",
        title: "Event Cancelled",
        body: `The event "${event.name}" has been deleted.`,
        data: {
          eventId: event._id.toString(),
          type: "EVENT",
          action: "EVENT_DELETED",
          url: `/(dynamic)/event`,
        },
      });
    }
  }

  // ✅ Send push notifications in chunks
  const chunks = expo.chunkPushNotifications(pushMessages);
  await Promise.all(
    chunks.map(async (chunk, index) => {
      try {
        const result = await expo.sendPushNotificationsAsync(chunk);
        console.log(`✅ Push chunk ${index + 1} sent, results:`, result);
      } catch (error) {
        console.error(`❌ Push notification chunk ${index + 1} failed:`, error);
      }
    })
  );

  await Promise.all(notificationPromises);

  // ✅ Delete event files from S3
  await deleteS3FileByUrl([event.bannerUrl, ...(event.multimediaUrl || [])]);

  // ✅ Delete the event itself
  await event.deleteOne();
  console.log("✅ Event deleted:", event._id);
  await StudentWithEvent.deleteMany({ eventId: id });

  res
    .status(200)
    .json({ success: true, message: "Event deleted successfully" });
});

export const joinEvent = asyncWrapper(async (req, res) => {
  const { studentId, eventIds } = req.body;
  if (!studentId || !Array.isArray(eventIds))
    throw new CustomError("Invalid input", 400);

  const created = [];
  for (const eventId of eventIds) {
    const exists = await StudentWithEvent.findOne({
      studentId: studentId,
      eventId: eventId,
    });
    if (exists) throw new CustomError("Student already joined this event", 400);

    const doc = await StudentWithEvent.create({
      studentId,
      eventId,
      allow: true,
    });

    created.push(doc);
  }

  res.status(201).json({ success: true, data: created });
});

export const toggleGoingStatus = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const { eventId, going } = req.body;

  const event = await Event.findById(eventId);
  if (!event) throw new CustomError("Event not found", 404);

  const existing = await StudentWithEvent.findOne({ studentId, eventId });
  if (!existing)
    throw new CustomError("Student has not joined this event", 400);

  existing.going = going;
  await existing.save();

  res.status(200).json({
    success: true,
    message: `Marked as ${going ? "Going" : "Not Going"}`,
  });
});
