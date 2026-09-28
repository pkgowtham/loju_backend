import mongoose from "mongoose";

const studentWithOfferSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    redeemedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("StudentWithOffer", studentWithOfferSchema);
