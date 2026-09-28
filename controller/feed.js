import {asyncWrapper} from "../utils/asyncWrapper.js";
import {CustomError} from "../utils/errorHandler.js";
import StudentWithSociety from "../model/studentWithSociety.js";
import Post from "../model/post.js";
import Event from "../model/event.js";
import StudentWithEvent from "../model/studentWithEvent.js";

// 🏠 Home Feed - Events and posts from Joined Societies
export const getFeedAll = asyncWrapper(async (req, res) => {
  const student = req.auth.details._id;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNum - 1) * pageLimit;

  // 🧠 Step 1: Get all joined society IDs
  const joined = await StudentWithSociety.find({ student }).select("society");
  const societyIds = joined.map(j => j.society);

  if (societyIds.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      joinedSocietys:Number(societyIds.length),
      page: pageNum,
      pageSize: 0,
      total: 0,
    });
  }

  // 🔢 Step 2: Count total posts and events
  const [postCount, eventCount] = await Promise.all([
    Post.countDocuments({ societyId: { $in: societyIds } }),
    Event.countDocuments({ society: { $in: societyIds } }),
  ]);

  const total = postCount + eventCount;

  if (total === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      page: pageNum,
      pageSize: 0,
      total: 0,
    });
  }

  // 📊 Step 3: Calculate weightage
  const postRatio = postCount / total;
  const eventRatio = eventCount / total;

  const postLimit = Math.round(pageLimit * postRatio);
  const eventLimit = pageLimit - postLimit;

  const postSkip = Math.round(skip * postRatio);
  const eventSkip = skip - postSkip;

  // 📥 Step 4: Fetch data
  const [posts, events] = await Promise.all([
    Post.find({ societyId: { $in: societyIds } })
      .populate("societyId", "name logo _id")
      .sort({ createdAt: -1 })
      .skip(postSkip)
      .limit(postLimit),

    Event.find({ society: { $in: societyIds } })
      .populate("society", "name logo _id")
      .sort({ createdAt: -1 })
      .skip(eventSkip)
      .limit(eventLimit),
  ]);

  // 🔍 Step 5: Map event IDs and fetch student-event relations
  const eventIds = events.map(e => e._id);
  const studentWithEvents = await StudentWithEvent.find({
    studentId: student,
    eventId: { $in: eventIds },
  });

  const eventMap = new Map();
  studentWithEvents.forEach(rel => {
    eventMap.set(rel.eventId.toString(), {
      joined: true,
      going: rel.going,
    });
  });

  // 🌀 Step 6: Combine with type + joined/going info
  const combined = [
    ...posts.map(p => ({ ...p.toObject(), type: "POST" })),
    ...events.map(e => {
      const rel = eventMap.get(e._id.toString()) || { joined: false, going: false };
      return {
        ...e.toObject(),
        type: "EVENT",
        joined: rel.joined,
        going: rel.going,
      };
    }),
  ];

  // 🕒 Step 7: Sort by latest
  combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({
    success: true,
    data: combined,
    joinedSocietys:Number(societyIds.length),
    page: pageNum,
    pageSize: combined.length,
    total,
  });
});

// 🏠 Home Feed - Events from Joined Societies
export const getEventFeed = asyncWrapper(async (req, res) => {
  const student = req.auth.details._id;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNum - 1) * pageLimit;

  // 🔍 Step 1: Get joined society IDs
  const joinedSocieties = await StudentWithSociety.find({ student }).select("society");
  const societyIds = joinedSocieties.map(j => j.society);

  // 🔢 Step 2: Get total events
  const total = await Event.countDocuments({ society: { $in: societyIds } });

  // 🧲 Step 3: Fetch events
  const events = await Event.find({ society: { $in: societyIds } })
    .populate("society", "name logo _id")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageLimit);

  // 🧠 Step 4: Get student-event relations
  const eventIds = events.map(e => e._id);
  const joinedEvents = await StudentWithEvent.find({
    studentId: student,
    eventId: { $in: eventIds }
  });

  // 🗺️ Step 5: Map relations
  const eventMap = {};
  joinedEvents.forEach(e => {
    eventMap[e.eventId.toString()] = {
      joined: true,
      going: e.going
    };
  });

  // 🔁 Step 6: Append to events
  const enrichedEvents = events.map(e => {
    const eventData = e.toObject();
    const eventStatus = eventMap[e._id.toString()] || { joined: false, going: false };
    return {
      ...eventData,
      joined: eventStatus.joined,
      going: eventStatus.going
    };
  });

  // 📤 Step 7: Response
  res.status(200).json({
    success: true,
    data: enrichedEvents,
    page: pageNum,
    pageSize: enrichedEvents.length,
    total,
  });
});

// 🏠 Home Feed - Posts from Joined Societies
export const getPostFeed = asyncWrapper(async (req, res) => {
  const student = req.auth.details._id;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNum - 1) * pageLimit;

  const joined = await StudentWithSociety.find({ student }).select("society");
  const societyIds = joined.map(j => j.society);

  const total = await Post.countDocuments({ societyId: { $in: societyIds } });

  const posts = await Post.find({ societyId: { $in: societyIds } }).populate("societyId", "name logo _id")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageLimit);

  res.status(200).json({
    success: true,
    data: posts,
    page: pageNum,
    pageSize: posts.length,
    total,
  });
});




