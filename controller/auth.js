import Student from "../model/student.js";
import User from "../model/user.js";
import { isStrongPassword } from "../utils/common.js";
import { CustomError } from "../utils/errorHandler.js";
import { hashPassword,comparePassword } from "../utils/hash.js";
import { renderEmailTemplate } from "../utils/htmlLoader.js";
import { sendEmail } from "../utils/sendEmail.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { generateToken } from "../utils/token.js";

// 🌟 Login Function 🌟
export const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate("details");
  if (!user) throw new CustomError("Invalid credentials - Email not found", 401);

  // 🛑 Check if blocked (for students only)
  if (user.role === "STUDENT" && user.details?.isBlocked) {
    throw new CustomError("Student Blocked", 409);
  }

  if (user.resetOtp) {
    throw new CustomError("Email is not verified. Please Verify through forgot password screens", 409);
  }

    // 🔐 Password validation
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) throw new CustomError("Invalid credentials - Password Incorrect", 401);

  // 🏫 University Population (based on role)
  if (user.role === "STUDENT") {
    await user.populate({
      path: "details",
      populate: { path: "university" },
    });
  } else if (user.role === "MAINTAINER") {
    await user.populate({
      path: "details",
      populate: { path: "universityId" },
    });
  }

  // 🎟️ Generate Token
  const token = generateToken({
    id: user._id,
    role: user.role,
    detailsId: user.details._id,
  });

  // ✅ Send Response
  res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      details: user.details,
    },
  });
});

export const validateResetEmail = asyncWrapper(async (req, res) => {
    const { email } = req.body;
  
    const user = await User.findOne({ email });
    if (!user) throw new CustomError("No User found with this email", 404);   
    
    res.status(200).json({ success: true, message: "Email is valid for reset" });
});
  
export const sendResetOtp = asyncWrapper(async (req, res) => {
    const { email } = req.body;
  
    const user = await User.findOne({ email});
    if (!user) throw new CustomError("Email not found", 404);
  
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 30 * 60 * 1000; // 30 min
    await user.save();
  
    const html = await renderEmailTemplate("reset", {
      otp,
      email,
      appName: "Student Events App",
    });
  
    await sendEmail({
      to: email,
      subject: "Reset your password - Student Events App",
      html,
    });
  
    res.status(200).json({ success: true, message: "OTP sent to email" });
});
  
export const verifyOtpAndResetPassword = asyncWrapper(async (req, res) => {
    const { email, otp, newPassword } = req.body;
  
    const user = await User.findOne({ email });
    if (!user || !user.resetOtp) throw new CustomError("OTP not initiated", 400);
  
    if (user.resetOtp !== otp) throw new CustomError("Invalid OTP", 400);
  
    if (Date.now() > user.resetOtpExpiry) {
      throw new CustomError("OTP expired", 410);
    }
  
    if (!isStrongPassword(newPassword)) {
        throw new CustomError("Password must be at least 8 characters with one uppercase, one number, and one special character", 400);
      }

    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword; 
    user.resetOtp = null;
    user.resetOtpExpiry = null;
  
    await user.save();
  
    res.status(200).json({ success: true, message: "Password has been reset" });
});

export const editExpoTokenPush = asyncWrapper(async (req, res) => {
   const { token } = req.body;

  if (!req.auth._id) {
    throw new CustomError("User ID is required", 400);
  }

  if (!token) {
    throw new CustomError("Expo token is required", 400);
  }

  // Find the user
  const user = await User.findById(req.auth._id);
  if (!user) {
    throw new CustomError("User not found", 404);
  }

  // Update the expo token
  user.notificationToken = token;
  await user.save();

  res.status(200).json({
    success: true,
    message: `${user.role} token updated successfully`,
    data: {
      userId: user._id,
      role: user.role,
      notificationToken: user.notificationToken,
    },
  });
});  

export const checkStudentBlockStatus = asyncWrapper(async (req, res) => {
  const { auth } = req;

  if (!auth) throw new CustomError("Unauthorized access", 401);

  // Only students can check this
  if (auth.role !== "STUDENT") {
    throw new CustomError("Only students can access this", 403);
  }

  // Get the student record
  const student = await Student.findById(auth.details._id).select("isBlocked firstName lastName");

  if (!student) throw new CustomError("Student not found", 404);

  res.status(200).json({
    success: true,
    message: "Student block status fetched successfully",
    data: {
      name: `${student.firstName} ${student.lastName}`,
      isBlocked: student.isBlocked,
    },
  });
});

  
