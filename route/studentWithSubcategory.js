// routes/studentWithSubcategory.js
import express from "express";
import { create, getList, destroy } from "../controller/studentWithSubcategory.js";

const router = express.Router();

router.post("/", create);
router.get("/:studentId", getList);
router.delete("/:studentId", destroy);

export default router;