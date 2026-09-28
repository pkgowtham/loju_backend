import mongoose, { Schema } from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "first name is rquired"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is rquired"],
    },
    year: {
      type: String,
      enum: {
        values: ["FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FOURTH_YEAR", "FOUNDATION_YEAR", "OTHER"],
        message: "{VALUE} is not supported",
      },
      required: [true, "Year is required"],
    },
    university: {
      type: Schema.Types.ObjectId,
      ref: "University",
      required: [true, "Last name is rquired"],
    },
    dp: {
      type: String,
    },
    avatarDisplay: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
    },
    avatarBg: {
      type: String,
    },
    isBlocked: { type: Boolean, default: false },
    socialHandles: {
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      snapchat: { type: String, default: "" },
    },
    societyAdmin: [
      {
        type: Schema.Types.ObjectId,
        ref: "Society",
      },
    ],
    chats: [{ type: Schema.Types.ObjectId, ref: "ChatGroups" }],
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

export default Student;
