import express from "express";
import * as controller from "../controller/report.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js";

const router = express.Router();

router.patch("/:reportId",authenticate,authorizeRole(["ADMIN","MAINTAINER"]),controller.updateStatus);
router.get("/",authenticate,authorizeRole(["ADMIN","MAINTAINER"]),controller.getList);

export default router;