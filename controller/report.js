import Report from "../model/report.js";
import Society from "../model/society.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import {CustomError} from "../utils/errorHandler.js";

export const getList = asyncWrapper(async (req, res) => {
  const { role, details } = req.auth;
  const {
    page = 1,
    limit = 10,
    studentId,
    societyId,
    reason,
    status,
  } = req.query;

  let filter = {
    ...(studentId && { studentId }),
    ...(societyId && { societyId }),
    ...(reason && { reason }),
    ...(status && { status }),
  };

  // 🧠 If Maintainer, restrict to their university's societies
  if (role === "MAINTAINER") {
    const { universityId } = details;
    const societies = await Society.find({ universityId: universityId }).select(
      "_id"
    );
    const societyIds = societies.map((s) => s._id);
    filter.societyId = { $in: societyIds };
  }

  const total = await Report.countDocuments(filter);

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate("studentId", "firstName lastName dp")
    .populate("societyId", "name logo");

  res.status(200).json({
    success: true,
    data: reports,
    total,
    page: Number(page),
    pageSize: reports.length,
  });
});

export const updateStatus = asyncWrapper(async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body;
  const { role } = req.auth;
  const { universityId } = req.auth.details;

  const allowedStatuses = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"];
  if (!allowedStatuses.includes(status))
    throw new CustomError("Invalid status value", 400);

  const report = await Report.findById(reportId).populate(
    "societyId",
    "studentId"
  );

  if (!report) throw new CustomError("Report not found", 404);

  // if (role === "MAINTAINER") {
  //   if (String(report.societyId.universityId) !== String(universityId))
  //     throw new CustomError(
  //       "You are not authorized to update this report",
  //       403
  //     );
  // }

  report.status = status;
  await report.save();

  res
    .status(200)
    .json({ success: true, message: "Report status updated", data: report });
});
