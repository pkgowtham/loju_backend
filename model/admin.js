import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "first name is rquired"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is rquired"],
    },
    dp: {
      type: String,
    },
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
