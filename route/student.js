import express from 'express'
import { authenticate,authorizeRole } from '../middleware/authentication.js';
import * as studentController from "../controller/student.js";

const router = express.Router();


router.post("/checkEmail", studentController.checkEmail);
router.post("/signup", studentController.signup);
router.post("/verifyOtp", studentController.verifyOtp);
router.patch("/:studentId/dp", studentController.updateDp);
router.patch("/:studentId/avatar", studentController.updateAvatar);
router.patch("/:studentId/bg", studentController.updateBg);
router.patch("/:studentId/social",authenticate,studentController.updateSocialHandles);
router.post("/resetPassword",authenticate,studentController.resetPassword);
router.post("/joinChat", studentController.joinChat);
router.post("/leaveChat", studentController.leaveChat);
router.patch("/update/:studentId", authenticate, studentController.updateStudentProfile);
router.delete("/delete/:studentId", authenticate,authorizeRole(["STUDENT",]),studentController.deleteStudent);




router.get("/getById",authenticate, studentController.getById);
router.get("/getByStudentSocietyId",authenticate, studentController.getByStudentSocietyId);
router.get("/getByUniversityId",authenticate,authorizeRole(["MAINTAINER"]),studentController.getByUniversityId);
router.patch("/block",authenticate,authorizeRole(["ADMIN","MAINTAINER"]), studentController.block);
router.patch("/unblock",authenticate,authorizeRole(["ADMIN","MAINTAINER"]), studentController.unblock);
router.delete('/delete',authenticate,authorizeRole(["ADMIN","MAINTAINER"]),studentController.destroy);
router.get("/",authenticate,authorizeRole(["ADMIN","MAINTAINER"]), studentController.getList);
// router.patch("/:studentId",,authenticate,authorizeRole(["MAINTAINER"]), studentController.update);

export default router;