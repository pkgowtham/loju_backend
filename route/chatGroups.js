import express from "express";
import * as chatGroupsController from "../controller/chatGroups.js";
import { authenticate,/* authorizeRole */ } from "../middleware/authentication.js";



const router = express.Router();


router.get("/chatGroupsList/:studentsId",authenticate/* ,authorizeRole(["ADMIN","STUDENT"]) */, chatGroupsController.getAllChatGroups);
router.post("/reportChat",authenticate, chatGroupsController.reportChat);



export default router;