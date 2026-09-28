// model/post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  description: { type: String, required: true },
  images: [{ type: String }],
}, { timestamps: true });

const Post = mongoose.model("Post", postSchema);

export default Post;
