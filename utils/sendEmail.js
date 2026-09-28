import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { CustomError } from "./errorHandler.js";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.SES_EMAIL_FROM;
  if (!from) {
    console.warn("⚠️ SES_EMAIL_FROM is not set in the environment");
    throw new CustomError("Sender email address not configured", 500);
  }
  const params = {
    Destination: { ToAddresses: [to] },
    Message: {
      Body: {
        Html: { Data: html },
      },
      Subject: { Data: subject },
    },
    Source: from.toString(),
  };

  try {
    await ses.send(new SendEmailCommand(params));
  } catch (err) {
    console.error("SES email send error:", err);
    throw new CustomError("Failed to send email", 500);
  }
};
