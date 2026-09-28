import mongoose, { Schema } from "mongoose";

const feedBackSchema = new mongoose.Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student Id is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    type: {
      type: String,
      enum: {
        values: ["BUG_REPORT", "FEATURE_REQUEST", "GENERAL", "SOCIETY_ISSUE"],
        message: "{VALUE} is not supported",
      },
      required: [true, "Type is required"],
    },

    multimediaUrl: [
      {
        type: String,
        required: [true, "multimediaUrl is required"],
      },
    ],
    email: {
      type: String,
      required: [true, "Banner is required"],
    },
  },
  { timestamps: true }
);

const FeedBack = mongoose.model("FeedBack", feedBackSchema);

export default FeedBack;
