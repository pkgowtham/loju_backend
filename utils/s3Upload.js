import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import path from "path";
import url from "url";
import { CustomError } from "./errorHandler.js";

const s3 = new S3Client({
  region: `${process.env.AWS_REGION}`,
  credentials: {
    accessKeyId: `${process.env.AWS_KEY}`,
    secretAccessKey: `${process.env.AWS_SECRET}`,
  },
});

export const handleMultipartUpload = async (
  req,
  constraints,
  folder = "uploads",
) => {
  const {
    maxFileSize = process.env.DEFAULT_MAX_FILE_SIZE,
    maxFileCount = process.env.DEFAULT_MAX_FILE_COUNT,
  } = constraints;

  const body = {};
  const uploadedFilesMap = {};
  let activeUploads = [];
  let currentFileCount = 0;

  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    req.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    req.on("end", async () => {
      const boundaryMatch = req.headers["content-type"].match(/boundary=(.+)$/);
      if (!boundaryMatch)
        throw new CustomError("Invalid multipart data", 400);

      const boundary = Buffer.from(`--${boundaryMatch[1]}`);
      const parts = buffer.split(boundary).slice(1, -1);

      try {
        for (let part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n");
          if (headerEnd === -1) continue;

          const headers = part.slice(0, headerEnd).toString();
          const content = part.slice(headerEnd + 4, part.length - 2); // trim trailing \r\n

          const nameMatch = headers.match(/name="([^"]+)"/);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);

          if (!nameMatch) continue;
          const name = nameMatch[1];

          if (!filenameMatch) {
            body[name] = content.toString();
            continue;
          }

          if (currentFileCount >= maxFileCount) {
            throw new CustomError("Maximum file upload limit exceeded", 400);
          }

          if (content.length > maxFileSize) {
            throw new CustomError("File size exceeds limit", 400);
          }

          const mimetype = contentTypeMatch
            ? contentTypeMatch[1]
            : "application/octet-stream";
          const ext = path.extname(filenameMatch[1]) || ".bin";
          const key = `${folder}/${randomUUID()}${ext}`;

         

          const upload = new Upload({
            client: s3,
            params: {
              Bucket: process.env.AWS_BUCKET,
              Key: key,
              Body: content,
              ContentType: mimetype,
            },
          });

          const uploadPromise = upload
            .done()
            .then((response) => {
              const url = `https://${process.env.AWS_CDN}/${key}`;
              if (!uploadedFilesMap[name]) uploadedFilesMap[name] = [];
              uploadedFilesMap[name].push(url);
            })
            .catch((err) => {
              console.error("Upload to S3 failed:", err);
              return reject(new CustomError("Upload to S3 failed", 500));
            });

          activeUploads.push(uploadPromise);
          currentFileCount++;
        }

        await Promise.all(activeUploads);
        resolve({ ...body, ...uploadedFilesMap });
      } catch (err) {
        console.error("Multipart parsing failed:", err);
        // reject(new CustomError("Multipart upload error", 500));
        reject(err);
      }
    });

    req.on("error", (err) => {
      console.error("Request stream error:", err);
      reject(new CustomError("Stream processing failed", 500));
    });
  });
};

Buffer.prototype.split = function (sep) {
  const parts = [];
  let start = 0;
  let index;
  while ((index = this.indexOf(sep, start)) !== -1) {
    parts.push(this.slice(start, index));
    start = index + sep.length;
  }
  parts.push(this.slice(start));
  return parts;
};

export const deleteS3FileByUrl = async (fileUrls = []) => {
  try {
    const deletePromises = fileUrls.map((fileUrl) => {
      const parsedUrl = url.parse(fileUrl);
      const key = decodeURIComponent(parsedUrl.pathname).slice(1); // remove leading slash
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: key,
      });
      return s3.send(command);
    });

    await Promise.all(deletePromises);
  } catch (err) {
    console.error("Failed to delete S3 file(s):", fileUrls, err);
    throw new CustomError("Failed to delete previous S3 image(s)", 500);
  }
};

export const uploadBufferToS3 = async (buffer, folder = "student-memoji") => {
  const key = `${folder}/${randomUUID()}.png`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    },
  });

  await upload.done();

  // Construct public URL
  return `https://${process.env.AWS_CDN}/${key}`;
};