import jwt from "jsonwebtoken";
import User from "../model/user.js";
import Student from "../model/student.js";
import Admin from "../model/admin.js";
import Maintainer from "../model/maintainer.js";
import { CustomError } from "../utils/errorHandler.js";
import {asyncWrapper} from "../utils/asyncWrapper.js";

const modelMap = {
  STUDENT: Student,
  ADMIN: Admin,
  MAINTAINER: Maintainer,
};

export const authenticate = asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    throw new CustomError("Authentication token missing", 401);

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) throw new CustomError("Invalid token", 401);

    const Model = modelMap[user.role];
    const details = await Model.findById(user.details);
    if (!details) throw new CustomError("Associated user not found", 401);

     // 🚫 Blocked Student Check
    if (user.role === "STUDENT" && details.isBlocked) {
      throw new CustomError("Your account has been blocked. Please contact the Tandem admin.", 403);
    }

    req.auth = {
      _id: user._id,
      role: user.role,
      email: user.email,
      details,
    };

    next();
  } catch (err) {
    throw new CustomError("Authentication failed", 401);
  }
});


export const authorizeRole = (roles) => {
  return (req, res, next) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      throw new CustomError("Insufficient permission", 403);
    }
    next();
  };
};
