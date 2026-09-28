import mongoose, { Schema } from "mongoose";

const studentWithSocietySchema = new mongoose.Schema(
  {
    society: {
      type: Schema.Types.ObjectId,
      ref: "Society",
      required: [true, "Society is required"],
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student Id is required"],
    },
    allow: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const StudentWithSociety = mongoose.model("StudentWithSociety", studentWithSocietySchema);

export default StudentWithSociety;
