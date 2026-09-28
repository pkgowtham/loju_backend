import Busboy from "busboy";
import { uploadToS3, deleteFromS3 } from "../utils/uploadToS3.js";
import asyncWrapper from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/CustomError.js";
import Announcement from "../model/announcement.js";

export const create = asyncWrapper(async (req, res) => {
  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  const multimediaUrl = [];

  req.pipe(busboy);

  busboy.on("field", (fieldname, val) => {
    fields[fieldname] = val;
  });

  busboy.on("file", async (fieldname, file, { mimeType }) => {
    const uploadedUrl = await uploadToS3(file, mimeType);
    multimediaUrl.push(uploadedUrl);
  });

  busboy.on("finish", async () => {
    const announcement = await Announcement.create({ ...fields, multimediaUrl });
    res.status(201).json({ success: true, data: announcement });
  });
});

export const update = asyncWrapper(async (req, res) => {
  const { announcementId } = req.params;
  const busboy = Busboy({ headers: req.headers });
  const fields = {};
  const newFiles = [];

  req.pipe(busboy);

  busboy.on("field", (fieldname, val) => {
    fields[fieldname] = val;
  });

  busboy.on("file", async (fieldname, file, { mimeType }) => {
    const uploadedUrl = await uploadToS3(file, mimeType);
    newFiles.push(uploadedUrl);
  });

  busboy.on("finish", async () => {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) throw new CustomError("Announcement not found", 404);

    if (newFiles.length) fields.multimediaUrl = [...announcement.multimediaUrl, ...newFiles];
    const updated = await Announcement.findByIdAndUpdate(announcementId, fields, { new: true });

    res.status(200).json({ success: true, data: updated });
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { announcementId } = req.params;
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new CustomError("Announcement not found", 404);

  await Promise.all(announcement.multimediaUrl.map(url => deleteFromS3(url)));
  await Announcement.findByIdAndDelete(announcementId);

  res.status(200).json({ success: true, message: "Announcement deleted" });
});

export const deleteImages = asyncWrapper(async (req, res) => {
  const { announcementId, urls } = req.body;
  if (!announcementId || !Array.isArray(urls)) throw new CustomError("Invalid data", 400);

  const announcement = await Announcement.findById(announcementId);
  if (!announcement) throw new CustomError("Announcement not found", 404);

  const remaining = announcement.multimediaUrl.filter(u => !urls.includes(u));
  await Promise.all(urls.map(url => deleteFromS3(url)));

  await Announcement.findByIdAndUpdate(announcementId, { multimediaUrl: remaining });
  res.status(200).json({ success: true, message: "Files removed" });
});
