import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: {
        values: ["ADMIN", "MAINTAINER", "STUDENT"],
        message: "{VALUE} is not supported",
      },
      required: [true, "Role is required"],
    },
    details: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "detailsModel",
    },
    detailsModel: {
      type: String,
      required: true,
      enum: ["Admin", "Maintainer", "Student"],
    },
    notificationToken: {
      type: String,
    },

    resetOtp: {
      type: String,
    },
    resetOtpExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
