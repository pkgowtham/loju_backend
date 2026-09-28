import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society"},
  chatGroupsId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatGroups"},
  type: {
    type: String,
    enum: ["SOCIETY", "CHAT"],
    default: "SOCIETY",
  },
  reason: [{
    type: String,
    enum: ["BULLYING", "HATE", "INAPPROPRIATE", "SPAM", "UNSAFE","OTHERS"],
    required: true,
  }],
  note:{
    type:String,   
  },
  status: {
    type: String,
    enum: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
    default: "OPEN",
  },
  
}, { timestamps: true });

export default mongoose.model("Report", reportSchema);
