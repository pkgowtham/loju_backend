import mongoose from "mongoose";

const studentWithSubcategorySchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },  
  subcategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subcategory",
    required: true,
  },
}, { timestamps: true });

export default mongoose.model("StudentWithSubcategory", studentWithSubcategorySchema);