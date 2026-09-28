import mongoose, { Schema } from "mongoose";


const universitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    shortName: {
      type: String,
      required: [true, "Short Name is required"],
    },
    website: {
      type: String,
      required: [true, "Website is required"],
    },
    emailDomain: {
      type: String,
      required: [true, "Email Domain is required"],
    },
    logo: [{
      type: String,
      required: [true, "Logo is required"],
    }],
  },
  { timestamps: true }
);

const University = mongoose.model("University", universitySchema);

export default University;
