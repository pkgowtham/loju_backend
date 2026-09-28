import NotificationSetting from "../model/notificationSetting.js";
import Student from "../model/student.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { validateUpdateBody } from "../utils/validation.js";


export const getByStudent = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    throw new CustomError("studentId is required", 400);
  }

  const notificationSetting = await NotificationSetting.findOne({ studentId });

  if (!notificationSetting) {
    throw new CustomError("Notification setting not found", 404);
  }

  res.status(200).json({
    success: true,
    data: notificationSetting,
  });
});


export const create = asyncWrapper(async (req, res) => {
    const body = req.body;

    const student = await Student.findById(body.studentId);
    if (!student) throw new CustomError("Student not found", 404);

    const notificationSetting = await NotificationSetting.create(body);

    res.status(201).json({
        success: true,
        message: "Notification setting created successfully",
        data: notificationSetting,
    });
});

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const notificationSetting = await NotificationSetting.findById(id);
  if (!notificationSetting) {
    throw new CustomError("Notification setting not found", 404);
  }

  await validateUpdateBody(NotificationSetting, req.body); 

  Object.assign(notificationSetting, req.body);
  await notificationSetting.save();

  res.status(200).json({
    success: true,
    message: "Notification setting updated successfully",
    data: notificationSetting,
  });
});