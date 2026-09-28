import jwt from "jsonwebtoken";

export const generateToken = (data) => {
  return jwt.sign(data, process.env.TOKEN_SECRET, {
    expiresIn: "30d",
  });
};
