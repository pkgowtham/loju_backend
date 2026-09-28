import express from "express";
import * as feedbackController from "../controller/feedBack.js";
import { authenticate, authorizeRole } from "../middleware/authentication.js";

const router = express.Router();


router.post("/",authenticate,authorizeRole(["STUDENT"]), feedbackController.create);
router.get("/",authenticate,authorizeRole(["ADMIN"]), feedbackController.getList);
router.delete("/:feedbackId",authenticate,authorizeRole(["ADMIN"]),feedbackController.destroy);

export default router;
