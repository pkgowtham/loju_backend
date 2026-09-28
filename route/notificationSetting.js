import express from "express";
import * as notificationSettingController from "../controller/notificationSetting.js";


const router = express.Router();

router.post("/", notificationSettingController.create);
router.patch("/update/:id", notificationSettingController.update);
router.get("/:studentId", notificationSettingController.getByStudent);

export default router;
