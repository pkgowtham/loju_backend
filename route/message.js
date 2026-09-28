import express from "express";
import axios from "axios";
import * as messageController from "../controller/message.js";


const router = express.Router();


router.get("/studentChannels/:studentId", messageController.getStudentGroupsWithChannels);
router.get("/studentMessages/:studentId/:channels", messageController.getStudentMessagesFromAllGroupsController);
router.post("/send", messageController.sendMessage);
router.patch('/students/:studentId/channels/:channelUrl/mark-read',messageController.markChannelAsRead);


export default router;
