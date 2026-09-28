
import mongoose, { Schema } from 'mongoose';

const chatGroupsSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Chess Club", "Football Team"
  societyId: { type: Schema.Types.ObjectId, ref: "Society" }, 
  studentsId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],// Array of user IDs
  channels: { type: String, match: [/^sendbird_group_channel_/, 'Invalid channel URL format']  }, // Array of channel URLs
  memberLimit: { type: Number, default: 5 }
});



const ChatGroups = mongoose.model("ChatGroups", chatGroupsSchema);

export default ChatGroups;
