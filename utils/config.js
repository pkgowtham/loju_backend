import dotenv from "dotenv";
dotenv.config();

/**
 * List of required environment variables for the application to function properly.
 * If any of these are missing on startup, the application warns or halts early.
 */
const requiredEnv = [
  "PORT",
  "MONGO_URI",
  "TOKEN_SECRET",
  "AWS_REGION",
  "AWS_KEY",
  "AWS_SECRET",
  "AWS_BUCKET",
  "AWS_CDN",
  "SES_EMAIL_FROM",
  "SENDBIRD_APP_ID",
  "SENDBIRD_API_TOKEN",
  "OPENAI_API_KEY",
];

export const validateEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️ Warning: Missing environment variables: ${missing.join(", ")}`);
  }
};

/**
 * Centralized Configuration Object.
 * Whenever you add a new key in .env, export it here for type safety and easy access.
 */
export const config = {
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.TOKEN_SECRET,
  aws: {
    region: process.env.AWS_REGION,
    key: process.env.AWS_KEY || process.env.AWS_ACCESS_KEY,
    secret: process.env.AWS_SECRET || process.env.AWS_SECRET_KEY,
    bucket: process.env.AWS_BUCKET,
    cdn: process.env.AWS_CDN,
    sesFrom: process.env.SES_EMAIL_FROM,
    maxFileSize: parseInt(process.env.DEFAULT_MAX_FILE_SIZE, 10) || 20971520,
    maxFileCount: parseInt(process.env.DEFAULT_MAX_FILE_COUNT, 10) || 5,
  },
  sendbird: {
    appId: process.env.SENDBIRD_APP_ID,
    apiToken: process.env.SENDBIRD_API_TOKEN,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};

export default config;
