import express from "express";
import * as universityController from "../controller/university.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js"


const router = express.Router();

router.post("/",authenticate,authorizeRole(["ADMIN"]), universityController.create);
router.get("/",authenticate,authorizeRole(["ADMIN"]), universityController.getList);
router.patch("/:id",authenticate,authorizeRole(["ADMIN"]), universityController.update);
router.delete("/:id",authenticate,authorizeRole(["ADMIN"]), universityController.destroy);

export default router;