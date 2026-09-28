import mongoose, { Schema } from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    type: {
      type: String,
      enum: {
        values: ["TOPICS", "SPORTS"],
        message: "{VALUE} is not supported",
      },
      required: [true, "Type is required"],
    },

    display: {
      type: Boolean,
      default: true,
    },
    icon: {
      type: String,
      required: [true, "Icon is required"],
    },
  },
  { timestamps: true }
);

const Category = mongoose.model("Category", categorySchema);

export default Category;
