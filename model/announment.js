import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema({
  message: { type: String, required: true },
  societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  multimediaUrl: [{ type: String }],
  display: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Announcement", announcementSchema);