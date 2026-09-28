import mongoose, { Schema } from "mongoose";

const notificationSettingSchema = new mongoose.Schema(
  {
    message: {
      type: Boolean,
      default: true,
    },
    event: {
      type: Boolean,
      default: true,
    },
    society: {
      type: Boolean,
      default: true,
    },
    offer: {
      type: Boolean,
      default: false,
    },
    post: {
      type: Boolean,
      default: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
  },
  { timestamps: true }
);

const NotificationSetting = mongoose.model("NotificationSetting", notificationSettingSchema);

export default NotificationSetting;