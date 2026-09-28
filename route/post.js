import express from "express";
import * as controller from "../controller/post.js";
import {authenticate} from "../middleware/authentication.js";

const router = express.Router();

router.post("/", authenticate, controller.create);
router.patch("/:id", authenticate, controller.update);
router.delete("/:id", authenticate, controller.destroy);
router.get("/",authenticate, controller.getBySocietyId);

export default router;