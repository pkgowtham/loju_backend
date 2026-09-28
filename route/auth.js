import express from 'express'
import * as authController from '../controller/auth.js';
import {authenticate,authorizeRole} from "../middleware/authentication.js"


const router = express.Router()

router.post('/',authController.login);
router.post('/validateResetEmail',authController.validateResetEmail);
router.post('/sendResetOtp',authController.sendResetOtp);
router.patch('/verifyOtpAndResetPassword',authController.verifyOtpAndResetPassword);
router.patch('/expoToken/:id', authenticate,authController.editExpoTokenPush);
router.get("/checkBlock",  authenticate, authController.checkStudentBlockStatus);




export default router;