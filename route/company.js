import express from "express";
import * as controller from "../controller/company.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js";

const router = express.Router();

router.post("/", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.create);
router.patch("/:id", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.update);
router.get("/", authenticate, authorizeRole(["ADMIN","STUDENT"]),controller.getList);
router.get("/getByUniversityId", authenticate, authorizeRole(["MAINTAINER"]),controller.getByUniversityId);
router.delete("/:id", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.destroy);

export default router;