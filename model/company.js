import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Company name is required"],
  },
  dpUrl: {
    type: String,
    required: [true, "Company display image is required"],
  },
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
  universityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "University",
    required: true,
  },
  contactEmail: {
    type: String,
    required: [true, "Contact email is required"],
    match: [/.+@.+\..+/, "Invalid email format"],
  },
}, { timestamps: true });

export default mongoose.model("Company", companySchema);