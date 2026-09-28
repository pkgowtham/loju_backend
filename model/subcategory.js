import mongoose, { Schema } from "mongoose";

const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
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
    },
  },
  { timestamps: true }
);

const Subcategory = mongoose.model("Subcategory", subcategorySchema);

export default Subcategory;
