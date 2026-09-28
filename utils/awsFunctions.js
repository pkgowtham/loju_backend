import dotenv from "dotenv";
import S3 from "aws-sdk/clients/s3.js";
dotenv.config();

export const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});