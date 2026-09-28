import FeedBack from "../model/feedBack.js";
import User from "../model/user.js";

import { asyncWrapper } from "../utils/asyncWrapper.js";
import { handleMultipartUpload } from "../utils/s3Upload.js";
import { CustomError } from "../utils/errorHandler.js";

export const create = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;

  const body = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 5,
    },
    "feedback"
  );

  const { description, type, email } = body;

  if (!description || !type || !email) {
    throw new CustomError("description, type and email are required", 400);
  }

  const multimediaUrl = body.multimedia || [];

  const feedback = await FeedBack.create({
    student: studentId,
    description,
    type: type,
    multimediaUrl,
    email,
  });

  res
    .status(201)
    .json({
      success: true,
      message: "Thank's for your feedback",
      data: feedback,
    });
});

export const getList = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, search = "", type } = req.query;

  const matchQuery = {};

  // 🔍 Filter by type if provided
  if (type) matchQuery.type = type;

  // 🔍 Search email

  if (search) {
    matchQuery.email = { $regex: search, $options: "i" };
  }

  const total = await FeedBack.countDocuments(matchQuery);
  const feedbacks = await FeedBack.find(matchQuery)
    .populate({
      path: "student",
      populate: {
        path: "university",
        model: "University",
      },
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: feedbacks,
    page: Number(page),
    pageSize: limit,
    total,
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { feedbackId } = req.params;

  const feedback = await FeedBack.findById(feedbackId);
  if (!feedback) throw new CustomError("Feedback not found", 404);

  await feedback.deleteOne();

  res.status(200).json({ success: true, message: "Feedback deleted" });
});
