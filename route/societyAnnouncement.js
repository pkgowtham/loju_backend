import express from "express";
import * as societyAnnouncementController from "../controller/societyAnnouncement.js";


const router = express.Router();

router.post("/announcement", societyAnnouncementController.broadcastAdminMessage);



export default router;
