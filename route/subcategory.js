import express from "express";
import * as subcategoryController from "../controller/subcategory.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js"


const router = express.Router();

router.post("/",authenticate,authorizeRole(["ADMIN"]), subcategoryController.create);
router.post("/SubcategoryCsv",authenticate,authorizeRole(["ADMIN"]), subcategoryController.createSubcategoriesFromCSV);
router.get("/", subcategoryController.getList);
router.patch("/:id",authenticate,authorizeRole(["ADMIN"]), subcategoryController.update);
router.delete("/:id",authenticate,authorizeRole(["ADMIN"]), subcategoryController.destroy);

export default router;
