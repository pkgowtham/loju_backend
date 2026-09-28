import mongoose, { Schema } from "mongoose";

const studentWithEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event is required"],
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student Id is required"],
    },
    going:{
      type: Boolean,
      default: true,
    },
    allow: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const StudentWithEvent = mongoose.model("StudentWithEvent", studentWithEventSchema);

export default StudentWithEvent;
