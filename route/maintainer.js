import express from "express";
import * as controller from "../controller/maintainer.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js";

const router = express.Router();

router.post("/", authenticate, authorizeRole(["ADMIN"]), controller.create);
router.post("/multiple", authenticate, authorizeRole(["ADMIN"]), controller.createMultiple);
router.patch("/:id", authenticate, authorizeRole(["ADMIN","MAINTAINER"]), controller.update);
router.get("/", authenticate, authorizeRole(["ADMIN"]), controller.getList);
router.delete("/:id", authenticate, authorizeRole(["ADMIN"]), controller.destroy);
router.patch("/inactive/:id", authenticate, authorizeRole(["ADMIN"]), controller.makeInactive);

export default router;