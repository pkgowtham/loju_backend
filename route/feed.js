import express from "express";
import * as controller from "../controller/feed.js";
import {authenticate} from "../middleware/authentication.js"

const router = express.Router();

router.get("/all",authenticate, controller.getFeedAll);
router.get("/event",authenticate, controller.getEventFeed);
router.get("/post",authenticate, controller.getPostFeed);



export default router;
