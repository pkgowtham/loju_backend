import express from "express";
import * as controller from "../controller/health.js";

const router = express.Router();


router.get("/",  controller.getList);
export default router;