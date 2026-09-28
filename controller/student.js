import ChatGroups from "../model/chatGroups.js";
import Society from "../model/society.js";
import Student from "../model/student.js";
import University from "../model/university.js";
import User from "../model/user.js";
import axios from "axios";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { isStrongPassword, fetchApi } from "../utils/common.js";
import { CustomError } from "../utils/errorHandler.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import {
  deleteS3FileByUrl,
  handleMultipartUpload,
  uploadBufferToS3,
} from "../utils/s3Upload.js";
import { generateToken } from "../utils/token.js";
import { sendEmail } from "../utils/sendEmail.js";
import { renderEmailTemplate } from "../utils/htmlLoader.js";
import NotificationSetting from "../model/notificationSetting.js";
import fetch from "node-fetch";
import FormData from "form-data";
import studentWithSubcategory from "../model/studentWithSubcategory.js";
import StudentWithSociety from "../model/studentWithSociety.js";
import StudentWithEvent from "../model/studentWithEvent.js";
import StudentWithOffer from "../model/studentWithOffer.js";
import Notification from "../model/notification.js";
import Report from "../model/report.js";
const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;

// ✅ 1. Check if email is allowed (based on university domain)
export const checkEmail = asyncWrapper(async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    throw new CustomError("Valid email is required", 400);
  }

  const emailExists = await User.findOne({ email: email });
  if (emailExists) {
    throw new CustomError("Email already exists", 409);
  }
  const domain = email.split("@")[1];
  const university = await University.findOne({ emailDomain: domain });
  if (!university) {
    throw new CustomError("Email domain not allowed", 400);
  }

  res.status(200).json({
    success: true,
    message: "Email is allowed",
    data: { universityId: university._id, universityName: university.name },
  });
});

// ✅ 2. Signup student + create user record
export const signup = asyncWrapper(async (req, res) => {
  const { firstName, lastName, year, email, password } = req.body;

  // ❌ Check for existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new CustomError("User with this email already exists", 409);
  }

  // 🏫 Extract domain and match university
  const domain = email.split("@")[1];
  const university = await University.findOne({ emailDomain: domain });
  if (!university) {
    throw new CustomError("Email domain not allowed", 400);
  }

  // 🔐 Validate password strength
  if (!isStrongPassword(password)) {
    throw new CustomError(
      "Password must be at least 8 characters with one uppercase, one number, and one special character",
      400
    );
  }

  // 🔒 Hash password
  const hashedPassword = await hashPassword(password);

  // 👤 Create student with university reference
  const student = await Student.create({
    firstName,
    lastName,
    year,
    university: university._id, // 📌 Store university ID here
  });

  // 🔗 Create user
  const user = await User.create({
    email,
    password: hashedPassword,
    role: "STUDENT",
    details: student._id,
    detailsModel: "Student",
  });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetOtp = otp;
  user.resetOtpExpiry = Date.now() + 30 * 60 * 1000; // 30 min
  await user.save();

  const html = await renderEmailTemplate("reset", {
    otp,
    email,
    appName: "Tandem Uni App",
  });

  await sendEmail({
    to: email,
    subject: "One Time Password (OTP) for Your Account",
    html,
  });
  // 🔑 Generate JWT token
  // const token = generateToken({
  //   id: user._id,
  //   role: user.role,
  //   detailsId: user.details._id,
  // });

  // 🎁 Send student + email + university info
  res.status(201).json({
    success: true,
    message:
      "Student registered successfully. Please verify your email with the OTP sent.",
    data: {
      ...student.toObject(),
      email: user.email,
      userId: user._id,
      university: {
        _id: university._id,
        name: university.name,
        emailDomain: university.emailDomain,
        logo: university.logo,
        website: university.website,
      },
    },
  });
});

export const verifyOtp = asyncWrapper(async (req, res) => {
  const { email, otp } = req.body;

  // Validate input
  if (!email || !otp) {
    throw new CustomError("Email and OTP are required", 400);
  }

  const user = await User.findOne({ email });
  if (!user || !user.resetOtp) throw new CustomError("OTP not initiated", 400);

  if (user.resetOtp !== otp) throw new CustomError("Invalid OTP", 400);

  if (Date.now() > user.resetOtpExpiry) {
    throw new CustomError("OTP expired", 410);
  }
  // ✅ OTP Verified - Clear OTP fields & mark user as verified
  user.resetOtp = undefined;
  user.resetOtpExpiry = undefined;
  user.isVerified = true;
  await user.save();

  // 3. Fetch additional user details based on role
  let userDetails = {};
  let university = {};

  if (user.role === "STUDENT") {
    const student = await Student.findById(user.details._id);
    const uni = await University.findById(student.university);

    userDetails = student.toObject();
    university = {
      _id: uni._id,
      name: uni.name,
      emailDomain: uni.emailDomain,
      logo: uni.logo,
      website: uni.website,
    };
    const notificationSetting = await NotificationSetting.create({
      studentId: student._id,
      message: true,
      event: true,
      society: true,
      offer: false,
      post: true,
    });

    userDetails.notificationSettings = notificationSetting;
  }

  // 🔑 Generate JWT token (now that user is verified)
  const token = generateToken({
    id: user._id,
    role: user.role,
    detailsId: user.details._id,
  });

  // 🎁 Send success response with token
  res.status(200).json({
    success: true,
    message: "Email verified successfully!",
    token,
    data: {
      ...userDetails,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      userId: user._id,
      ...(user.role === "STUDENT" && { university }), // Conditionally add university
    },
  });
});

export const updateStudentProfile = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { firstName, lastName, year } = req.body;

  if (!studentId) throw new CustomError("studentId is required", 400);

  if (!firstName || !lastName || !year) {
    throw new CustomError("firstName, lastName, and year are required", 400);
  }

  const allowedYears = [
    "FIRST_YEAR",
    "SECOND_YEAR",
    "THIRD_YEAR",
    "FOURTH_YEAR",
    "FOUNDATION_YEAR",
    "OTHER",
  ];
  if (!allowedYears.includes(year)) {
    throw new CustomError(`${year} is not supported`, 400);
  }

  const student = await Student.findByIdAndUpdate(
    studentId,
    { firstName, lastName, year },
    { new: true }
  );

  if (!student) throw new CustomError("Student not found", 404);

  res.status(200).json({ success: true, data: student });
});

//  ✅ 3. Update general profile data (like name/year) — optional
export const updateDp = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  // Handle multipart upload (file field name is assumed to be "dp")
  const data = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 1,
    },
    "student"
  );

  const uploadedUrls = data.dp; // handleMultipartUpload returns { dp: [url] }

  if (!uploadedUrls || !uploadedUrls.length) {
    throw new CustomError(
      "No DP image uploaded,skipping memoji generation",
      400
    );
  }

  // Delete old DP if present
  if (student.dp) {
    try {
      await deleteS3FileByUrl([student.dp]);
    } catch (err) {
      console.error("Error deleting old DP from S3:", err.message);
    }
  }

  // Update student DP
  const dpUrl = uploadedUrls[0];
  student.dp = dpUrl;
  await student.save();

  // --- OpenAI Memoji Generation ---
  try {
    const imageBuffer = Buffer.from(
      await fetch(dpUrl).then((r) => r.arrayBuffer())
    );

    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append(
      // "prompt",
      // "Create a 3D-style cartoon memoji avatar of the uploaded face. Detect only the head/face, remove hands, shoulders, or body. Keep the background fully transparent with no color fill."
      "prompt",
      "A 3D digital illustration of the uploaded student profile picture, rendered as a cartoon-style memoji avatar. Include only the head/face, removing shoulders, hands, or any body parts. The background must be completely removed and fully transparent (no white, no color fill, no gradient)."
    );
    formData.append("size", "1024x1024"); // ✅ use valid size
    formData.append("background", "transparent");
    formData.append("image", imageBuffer, {
      filename: "dp.png",
      contentType: "image/png",
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    });

    const result = await response.json();
    // console.log("OpenAI response:", result);-- result res

    if (result.data && result.data[0]?.b64_json) {
      // ✅ Convert base64 → Buffer
      const memojiBuffer = Buffer.from(result.data[0].b64_json, "base64");

      // ✅ Upload to S3
      const s3Key = `student-avatars/${studentId}-memoji.png`;
      const s3Url = await uploadBufferToS3(memojiBuffer, s3Key, "image/png");

      // ✅ Save permanent S3 URL in DB
      student.avatar = s3Url;
      await student.save();
    } else {
      console.error("OpenAI returned no image data");
    }
  } catch (err) {
    console.error("OpenAI memoji generation failed:", err.message);
  }

  res.status(200).json({
    success: true,
    message: "DP uploaded and avatars generated",
    dp: dpUrl,
    avatar: student.avatar,
  });
});

//  ✅ 5. Update selected avatar
export const updateAvatar = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { avatar } = req.body;

  if (!avatar) throw new CustomError("Avatar URL is required", 400);

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  student.avatar = avatar;
  await student.save();

  res.status(200).json({
    success: true,
    message: "Avatar updated successfully",
    data: { avatar: student.avatar },
  });
});

//  ✅ 6. Update background color for avatar
export const updateBg = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { avatarBg, avatarDisplay } = req.body;

  if (!avatarBg || !/^#[0-9A-Fa-f]{6}$/.test(avatarBg)) {
    throw new CustomError("Invalid background color hex code", 400);
  }

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  student.avatarBg = avatarBg;
  student.avatarDisplay = avatarDisplay;
  await student.save();

  res.status(200).json({
    success: true,
    message: "Background color updated successfully",
    data: { avatarBg: student.avatarBg },
  });
});

//  ✅ 7. Update Social Handles
export const updateSocialHandles = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { instagram, tiktok, snapchat } = req.body;

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  student.socialHandles = { instagram, tiktok, snapchat };
  await student.save();

  res.status(200).json({
    success: true,
    message: "Social handles updated successfully",
    data: student.socialHandles,
  });
});

//  ✅ 8. Update password
export const resetPassword = asyncWrapper(async (req, res) => {
  const { email, newPassword, oldPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new CustomError("Email not found", 400);

  if (oldPassword && !(await comparePassword(oldPassword, user.password))) {
    throw new CustomError("Current Password is incorrect", 404);
  }

  if (!isStrongPassword(newPassword)) {
    throw new CustomError(
      "Password must be at least 8 characters with one uppercase, one number, and one special character",
      400
    );
  }

  const hashedPassword = await hashPassword(newPassword);

  user.password = hashedPassword;
  user.resetOtp = null;
  user.resetOtpExpiry = null;

  await user.save();

  res.status(200).json({ success: true, message: "Password has been reset" });
});

// ✅ 9. Get student list (admin only)
export const getList = asyncWrapper(async (req, res) => {
  const {
    search = "",
    page = 1,
    limit = 10,
    type, // "BLOCKED", "ADMIN", "USER"
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const searchRegex = new RegExp(search, "i");

  const userMatches = await User.find({ email: searchRegex });
  const matchedUserIds = userMatches.map((user) => user.details);

  const query = {
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { _id: { $in: matchedUserIds } },
    ],
  };

  if (type === "BLOCKED") query.isBlocked = true;
  else if (type === "ADMIN")
    query.societyAdmin = { $exists: true, $not: { $size: 0 } };
  else if (type === "USER") query.societyAdmin = { $size: 0 };

  const students = await Student.find(query)
    .sort({ firstName: 1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Student.countDocuments(query);

  const studentsWithEmails = await Promise.all(
    students.map(async (student) => {
      const user = await User.findOne({
        details: student._id,
        detailsModel: "Student",
      });
      return {
        ...student.toObject(),
        email: user?.email || "",
      };
    })
  );

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pageSize: students.length,
    data: studentsWithEmails,
  });
});

// ✅ 9. Get student list (Maintainer only)
export const getByUniversityId = asyncWrapper(async (req, res) => {
  const {
    search = "",
    page = 1,
    limit = 10,
    type, // "BLOCKED", "ADMIN", "USER"
  } = req.query;

  const { universityId } = req.auth?.details;
  if (!universityId) throw new CustomError("University ID not found", 400);

  const skip = (Number(page) - 1) * Number(limit);

  const searchRegex = new RegExp(search, "i");

  const userMatches = await User.find({ email: searchRegex });
  const matchedUserIds = userMatches.map((user) => user.details);

  const query = {
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { _id: { $in: matchedUserIds } },
    ],
  };

  if (universityId) query.university = universityId.toString();

  if (type === "BLOCKED") query.isBlocked = true;
  else if (type === "ADMIN")
    query.societyAdmin = { $exists: true, $not: { $size: 0 } };
  else if (type === "USER") query.societyAdmin = { $size: 0 };

  const students = await Student.find(query)
    .sort({ firstName: 1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Student.countDocuments(query);

  const studentsWithEmails = await Promise.all(
    students.map(async (student) => {
      const user = await User.findOne({
        details: student._id,
        detailsModel: "Student",
      });
      return {
        ...student.toObject(),
        email: user?.email || "",
      };
    })
  );

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pageSize: students.length,
    data: studentsWithEmails,
  });
});

//  ✅ 10. Get student by ID
export const getById = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const student = await Student.findById(studentId).populate("chats");
  if (!student) throw new CustomError("Student not found", 404);

  res.status(200).json({
    success: true,
    data: student,
  });
});

export const getByStudentSocietyId = asyncWrapper(async (req, res) => {
  const studentId = req.auth.details._id;
  const society = await Society.find({
    $or: [{ adminId: studentId }, { activityAdminId: { $in: [studentId] } }],
  }).sort({ name: 1 });
  if (!society) throw new CustomError("Society not found", 404);

  res.status(200).json({
    success: true,
    data: society,
  });
});

//  ✅ 11. Block array of students student
export const block = asyncWrapper(async (req, res) => {
  const { studentIds = [] } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new CustomError("studentIds array is required", 400);
  }

  const result = await Student.updateMany(
    { _id: { $in: studentIds } },
    { $set: { isBlocked: true } }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} student(s) blocked`,
  });
});

export const unblock = asyncWrapper(async (req, res) => {
  const { studentIds = [] } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new CustomError("studentIds array is required", 400);
  }

  const result = await Student.updateMany(
    { _id: { $in: studentIds } },
    { $set: { isBlocked: false } }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} student(s) un-blocked`,
  });
});

// // ✅ 12. delete array of students
export const destroy = asyncWrapper(async (req, res) => {
  const { studentIds = [] } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new CustomError("studentIds array is required", 400);
  }

  const students = await Student.find({ _id: { $in: studentIds } });

  if (!students.length) throw new CustomError("No valid students found", 404);

  // Delete related users too
  await User.deleteMany({
    details: { $in: studentIds },
    detailsModel: "Student",
  });
  await Student.deleteMany({ _id: { $in: studentIds } });

  res.status(200).json({
    success: true,
    message: `${students.length} student(s) deleted`,
  });
});

// ✅ 13. Join a chat group
export const joinChat = async (req, res) => {
  const { studentId, societyId } = req.body;
  const DEFAULT_MEMBER_LIMIT = 5; // Centralized configuration

  // Validate required fields
  if (!studentId || !societyId) {
    return res.status(400).json({ message: "Missing studentId or societyId" });
  }

  try {
    // Fetch student and society data in parallel
    const [student, society] = await Promise.all([
      Student.findById(studentId),
      Society.findById(societyId).populate("adminId"),
    ]);

    // Check if both student and society exist
    if (!student || !society) {
      return res.status(404).json({ message: "Student or Society not found" });
    }

    // Check if student is already in any chat group for this society
    const existingChatForStudent = await ChatGroups.findOne({
      societyId: society._id,
      studentsId: student._id.toString(),
    });

    if (existingChatForStudent) {
      return res.status(200).json({
        message: "Student is already in a chat group for this society",
        chat: existingChatForStudent,
      });
    }

    /* ====================== */
    /*  SEND BIRD USER SETUP  */
    /* ====================== */
    const usersToCreate = [
      {
        user_id: student._id.toString(),
        nickname: `${student.firstName} ${student.lastName}`,
        profile_url: student.dp || student.avatar || "",
        profile: {
          custom_fields: {
            avatarBg: student.avatarBg || "#FFD700",
          },
        },
      },
    ];

    if (society.adminId) {
      try {
        await axios.get(`${BASE_URL}/users/${society.adminId._id.toString()}`, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
        });
      } catch (err) {
        if (err.response?.status === 404) {
          usersToCreate.push({
            user_id: society.adminId._id.toString(),
            nickname: `${society.adminId.firstName} ${society.adminId.lastName}`,
            profile_url: society.adminId.avatar || "",
          });
        }
      }
    }

    for (const user of usersToCreate) {
      try {
        await axios.post(`${BASE_URL}/users`, user, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
        });
      } catch (err) {
        const errorCode = err.response?.data?.code;
        if (![400201, 400202].includes(errorCode)) {
          console.error(
            `[SendBird] User creation failed for ID: ${user.user_id}`,
            `| Status: ${err.response?.status || "No response"}`,
            `| Code: ${errorCode || "N/A"}`,
            `| Reason: ${err.response?.data?.message || err.message}`
          );
        }
      }
    }

    /* ========================== */
    /*  FIND AVAILABLE CHAT GROUP  */
    /* ========================== */
    const allChats = await ChatGroups.find({ societyId: society._id });
    let availableChat = null;

    for (const chat of allChats) {
      const channelUrl = chat.channels;
      if (!channelUrl?.startsWith("sendbird_group_channel_")) continue;

      try {
        const response = await axios.get(
          `${BASE_URL}/group_channels/${channelUrl}/members?limit=100`,
          { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
        );

        const currentMembers = response.data.members || [];
        const currentMemberCount = currentMembers.length;
        const groupLimit = chat.memberLimit || DEFAULT_MEMBER_LIMIT;

        // Calculate required space considering admin status
        const adminAlreadyInGroup = chat.studentsId.includes(
          society.adminId?._id.toString()
        );
        const requiredSpace = society.adminId && !adminAlreadyInGroup ? 2 : 1;

        if (currentMemberCount + requiredSpace <= groupLimit) {
          availableChat = chat;
          break;
        }
      } catch (err) {
        console.warn(
          `Could not verify SendBird channel ${channelUrl}:`,
          err.message
        );
        continue;
      }
    }

    /* ======================= */
    /*  CHAT GROUP MANAGEMENT  */
    /* ======================= */
    let finalChat;

    if (availableChat) {
      // Join existing chat
      const updateData = {
        $addToSet: {
          studentsId: { $each: [student._id.toString()] },
        },
      };

      if (
        society.adminId &&
        !availableChat.studentsId.includes(society.adminId._id.toString())
      ) {
        updateData.$addToSet.studentsId.$each.push(
          society.adminId._id.toString()
        );
      }

      finalChat = await ChatGroups.findByIdAndUpdate(
        availableChat._id,
        updateData,
        { new: true }
      );

      const usersToAdd = [student._id.toString()];
      if (
        society.adminId &&
        !availableChat.studentsId.includes(society.adminId._id.toString())
      ) {
        usersToAdd.push(society.adminId._id.toString());
      }

      try {
        await axios.post(
          `${BASE_URL}/group_channels/${finalChat.channels}/invite`,
          { user_ids: usersToAdd },
          { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
        );
      } catch (err) {
        if (err.response?.data?.code !== 400201) {
          console.error(
            "Error inviting users to SendBird channel:",
            err.message
          );
          throw err;
        }
      }
    } else {
      // Create new chat group
      const chatCount = await ChatGroups.countDocuments({
        societyId: society._id,
      });
      const nextChatNumber = chatCount + 1;

      const initialMembers = [student._id.toString()];
      if (society.adminId) {
        initialMembers.push(society.adminId._id.toString());
      }

      const sbResponse = await axios.post(
        `${BASE_URL}/group_channels`,
        {
          name: `${society.name} Chat ${nextChatNumber}`,
          is_distinct: false,
          is_public: false,
          user_ids: initialMembers,
          cover_url: society.logo || society.banner || "",
        },
        { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
      );

      // Create with explicit memberLimit from schema default
      finalChat = await ChatGroups.create({
        name: `${society.name} Chat ${nextChatNumber}`,
        societyId: society._id,
        studentsId: initialMembers,
        channels: sbResponse.data.channel_url,
        // memberLimit will default to 5 from schema
      });

      if (society.adminId) {
        await Student.findByIdAndUpdate(society.adminId._id, {
          $addToSet: { chats: finalChat._id },
        });
      }
    }

    // Update student's chat list
    await Student.findByIdAndUpdate(student._id, {
      $addToSet: { chats: finalChat._id },
    });

    return res.status(200).json({
      message: "Student joined chat group",
      chat: finalChat,
    });
  } catch (error) {
    console.error("Join chat error:", error);
    return res.status(500).json({
      message: "Failed to join chat",
      error: error.message,
    });
  }
};

/* ✅ 14. Leave the group chat */

export const leaveChat = asyncWrapper(async (req, res) => {
  const { studentId, chatGroupId, reason, note } = req.body;

  // Validate required fields
  if (!studentId || !chatGroupId) {
    return res
      .status(400)
      .json({ message: "Missing studentId or chatGroupId" });
  }

  // Fetch student and chat group data in parallel
  const [student, chatGroup] = await Promise.all([
    Student.findById(studentId),
    ChatGroups.findById(chatGroupId).populate("societyId"),
  ]);

  // Check if both student and chat group exist
  if (!student || !chatGroup) {
    return res.status(404).json({ message: "Student or Chat Group not found" });
  }

  // Check if student is actually in this chat group
  if (!chatGroup.studentsId.includes(student._id.toString())) {
    return res
      .status(400)
      .json({ message: "Student is not in this chat group" });
  }

  // Check if the student is the society admin
  if (chatGroup.societyId?.adminId?.toString() === student._id.toString()) {
    return res.status(403).json({
      message: "Society admin cannot leave their own chat group",
    });
  }

  if (reason) {
    await Report.create({
      studentId,
      societyId: chatGroup.societyId._id,
      reason,
      note,
      type: "CHAT",
    });
  }

  /* ======================== */
  /*  SEND BIRD CHANNEL EXIT  */
  /* ======================== */
  if (chatGroup.channels?.startsWith("sendbird_group_channel_")) {
    // Correct: Use PUT instead of DELETE for leaving a channel
    await axios
      .put(
        `${BASE_URL}/group_channels/${chatGroup.channels}/leave`,
        { user_ids: [student._id.toString()] }, // Must be an array
        { headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN } }
      )
      .catch((err) => {
        console.error(
          `Error leaving SendBird channel:`,
          err.response?.data || err.message
        );
        throw new Error("Failed to leave SendBird channel");
      });
  }

  /* ======================= */
  /*  CHAT GROUP MANAGEMENT  */
  /* ======================= */
  // Remove student from chat group
  const updatedChatGroup = await ChatGroups.findByIdAndUpdate(
    chatGroupId,
    { $pull: { studentsId: student._id.toString() } },
    { new: true }
  );

  // Remove chat from student's chat list
  await Student.findByIdAndUpdate(
    studentId,
    {
      $pull: { chats: chatGroup._id },
    },
    { new: true }
  );

  /* ===================== */
  /*  CLEANUP EMPTY CHATS  */
  /* ===================== */
  // If chat is now empty (or only contains admin), consider deleting it
  // Improved cleanup condition
  const isAdmin = chatGroup.societyId?.adminId?.toString();
  const remainingMembers = updatedChatGroup.studentsId.map((id) =>
    id.toString()
  );

  const shouldDeleteGroup =
    remainingMembers.length === 0 ||
    (remainingMembers.length === 1 && remainingMembers[0] === isAdmin);

  if (shouldDeleteGroup) {
    try {
      // Delete SendBird channel
      if (chatGroup.channels?.startsWith("sendbird_group_channel_")) {
        await axios.delete(`${BASE_URL}/group_channels/${chatGroup.channels}`, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
        });
      }

      // Delete chat group
      await ChatGroups.findByIdAndDelete(chatGroupId);

      return res.status(200).json({
        success: true,
        message: "Student left and empty group was deleted",
        deleted: true,
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      return res.status(200).json({
        success: true,
        message: "Student left but cleanup failed",
        warning: error.message,
        deleted: false,
      });
    }
  }

  return res.status(200).json({
    message: "Student left chat group",
    chat: updatedChatGroup,
  });
});

/* export const deleteStudent = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { alternativeStudentId } = req.body;
  const requesterRole = req.auth.role;

  if (!studentId) throw new CustomError("studentId is required", 400);

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  const societyAdminIds = student.societyAdmin || [];

  // 🎓 Case 1: Request made by STUDENT
  if (requesterRole === "STUDENT" && societyAdminIds.length > 0) {
    const societies = await Society.find({
      _id: { $in: societyAdminIds },
    }).select("name logo");
    return res.status(403).json({
      success: false,
      message:
        "Cannot delete society admin. Please contact maintainer to transfer admin rights.",
      societies,
    });
  }

  // 🛠️ Case 2: Request made by MAINTAINER
  if (requesterRole === "MAINTAINER" && societyAdminIds.length > 0) {
    if (!alternativeStudentId) {
      throw new CustomError(
        "Alternative studentId is required to replace admin",
        400
      );
    }

    const altStudent = await Student.findById(alternativeStudentId);
    if (!altStudent)
      throw new CustomError("Alternative student not found", 404);

    await Society.updateMany(
      { _id: { $in: societyAdminIds } },
      {
        $pull: { societyAdmin: studentId },
        $addToSet: { societyAdmin: alternativeStudentId },
      }
    );

    // ✅ Update altStudent’s societyAdmin array
    altStudent.societyAdmin = [
      ...new Set([
        ...altStudent.societyAdmin,
        ...societyAdminIds.map((id) => id.toString()),
      ]),
    ];
    await altStudent.save();
  }
   // 🧹 Soft Delete: Update student & user instead of deleting
  const DELETED_PROFILE_URL =
    "https://d3hgroojph8hh.cloudfront.net/emailtemplate/emailTemplateLogo.png";

  // Update Student
  student.name = "Deleted User";
  student.profileUrl = DELETED_PROFILE_URL;
  await student.save();

  // Update related User
  await User.updateOne(
    { details: studentId },
    {
      $set: {
        name: "Deleted User",
        profileUrl: DELETED_PROFILE_URL,
      },
    }
  );

  // Update Sendbird user via REST API
  try {
    await axios.put(
      `${BASE_URL}/users/${studentId}`,
      {
        nickname: "Deleted User",
        profile_url: DELETED_PROFILE_URL,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Api-Token": process.env.SENDBIRD_API_TOKEN,
        },
      }
    );
  } catch (error) {
    console.error(
      "Sendbird update failed:",
      error.response?.data || error.message
    );
  }

  // / Remove student from all ChatGroups
  await ChatGroups.updateMany(
    { studentsId: student._id.toString() },
    { $pull: { studentsId: student._id.toString() } }
  );

  // 🧹 Cascade Delete
  await Promise.all([
    StudentWithSubcategory.deleteMany({ studentId }),
    StudentWithSociety.deleteMany({ studentId }),
    StudentWithEvent.deleteMany({ studentId }),
    StudentWithOffer.deleteMany({ studentId }),
    Notification.deleteMany({ studentId }),
    NotificationSetting.deleteMany({ studentId }),
    Report.deleteMany({ studentId }),
    User.deleteOne({ details: studentId }),
    Student.findByIdAndDelete(studentId),
  ]);

  res.status(200).json({
    success: true,
    message: "Student and all related data deleted successfully",
  });
}); */

export const deleteStudent = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) throw new CustomError("studentId is required", 400);

  const student = await Student.findById(studentId);
  if (!student) throw new CustomError("Student not found", 404);

  const societyAdminIds = student.societyAdmin || [];

  // ⚡ If student is society admin → remove from those societies
  if (societyAdminIds.length > 0) {
    await Society.updateMany(
      { adminId: studentId },
      { $unset: { adminId: "" } }
    );
  }

  // 🧹 Soft Delete: Update student & user instead of deleting
  const DELETED_PROFILE_URL =
    "https://d3hgroojph8hh.cloudfront.net/emailtemplate/emailTemplateLogo.png";

  // Update Student
  student.name = "Deleted User";
  student.profileUrl = DELETED_PROFILE_URL;
  await student.save();

  // Update related User
  await User.updateOne(
    { details: studentId },
    {
      $set: {
        name: "Deleted User",
        profileUrl: DELETED_PROFILE_URL,
      },
    }
  );

  // Update Sendbird user via REST API
  try {
    await axios.put(
      `${BASE_URL}/users/${studentId}`,
      {
        nickname: "Deleted User",
        profile_url: DELETED_PROFILE_URL,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Api-Token": process.env.SENDBIRD_API_TOKEN,
        },
      }
    );
  } catch (error) {
    console.error(
      "Sendbird update failed:",
      error.response?.data || error.message
    );
  }

  // / Remove student from all ChatGroups
  await ChatGroups.updateMany(
    { studentsId: student._id.toString() },
    { $pull: { studentsId: student._id.toString() } }
  );

  await studentWithSubcategory.deleteMany({ studentId });
  await StudentWithSociety.deleteMany({ studentId });
  await StudentWithEvent.deleteMany({ studentId });
  await StudentWithOffer.deleteMany({ studentId });
  await Notification.deleteMany({ studentId });
  await NotificationSetting.deleteMany({ studentId });
  await Report.deleteMany({ studentId });
  await User.deleteOne({ details: studentId });
  await Student.findByIdAndDelete(studentId);

  res.status(200).json({
    success: true,
    message: "Student and all related data deleted successfully",
  });
});

//get society by student adminid
