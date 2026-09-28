import mongoose, { Schema } from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    description: {
      type: String,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
    },
    locationUrl: {
      type: String,
    },
    society: {
      type: Schema.Types.ObjectId,
      ref: "Society",
      required: [true, "Society is required"],
    },
    startingTime: {
      type: Date,
      required: [true, "Starting time is required"],
    },
    endingTime: {
      type: Date,
      required: [true, "Ending time is required"],
    },
    
    multimediaUrl: [
      {
        type: String,
      },
    ],
    bannerUrl: {
      type: String,
      required: [true, "Banner is required"],
    },
    display: {
      type: Boolean,
      default: true,
    },
    sharable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
