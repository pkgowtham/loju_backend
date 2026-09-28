import express from "express";
import * as notificationController from "../controller/notification.js";
import { authenticate } from "../middleware/authentication.js";



const router = express.Router();


router.get("/remainder/:studentId",authenticate, notificationController.getById);
router.delete("/:id", notificationController.destroy);
router.post("/", authenticate, notificationController.create);
router.delete("/clearUpNoification/:studentId", notificationController.clearUpNotification);


export default router;