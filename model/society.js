import mongoose, { Schema } from "mongoose";

const societySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    universityId: {
      type: Schema.Types.ObjectId,
      ref: "University",
      required: [true, "University is required"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "Subcategory",
      required: [true, "Subcategory is required"],
    },
    instagramUrl: {
      type: String,
    },
    type: {
      type: String,
      enum: {
        values: ["TOPICS", "SPORTS"],
        message: "{VALUE} is not supported",
      },
      required: [true, "Type is required"],
    },

    logo: {
      type: String,
      required: [true, "Logo is required"],
    },
    banner: {
      type: String,
      required: [true, "Banner is required"],
    },
    display: {
      type: Boolean,
      default: true,
    },
    follower: {
      type: Number,
      default: 0,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Student"
    },
    activityAdminId: [{
      type: Schema.Types.ObjectId,
      ref: "Student"
    }]
  },
  { timestamps: true }
);

const Society = mongoose.model("Society", societySchema);

export default Society;
