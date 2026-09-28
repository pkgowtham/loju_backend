import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
    },
    description: { type: String, required: true },
    location: { type: String, required: true },
    terms: { type: String, required: true },
    procedure: { type: String, required: true },
    startingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    category: {
      type: String,
      enum: [
        "BEAUTY & FASHION",
        "ELECTRONICS",
        "FOOD & BEVERAGE",
        "TRAVEL",
        "EDUCATION",
        "ENTERTAINMENT",
        "HEALTH",
        "OTHER",
      ],
      required: true,
    },
    dpUrl: { type: String, required: true },
    code: { type: String, required: true },
    availLink: { type: String, required: true },
    contactEmail: {
      type: String,
      match: [/.+@.+\..+/, "Invalid email format"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);
