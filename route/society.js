import express from "express";
import * as societyController from "../controller/society.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js"
import maintainer from "../model/maintainer.js";

const router = express.Router();

router.post("/",authenticate,authorizeRole(["MAINTAINER"]), societyController.create);
router.post("/societyCsv",authenticate,authorizeRole(["MAINTAINER"]), societyController.createSocietiesFromCSV);
router.patch("/:id", authenticate,authorizeRole(["MAINTAINER"]),societyController.update);
router.delete("/:id", authenticate,authorizeRole(["MAINTAINER"]),societyController.destroy);
router.get("/getAll",authenticate, societyController.getAll);
router.get("/getByStudentInterest",authenticate, societyController.getByStudentInterest);
router.get("/getByStudentJoined",authenticate, societyController.getByStudentJoined);
router.get("/getByStudentNotInterest",authenticate, societyController.getByStudentNotInterest);
router.get("/getByCategory/:categoryId",authenticate, societyController.getByCategory);
router.post("/getBySubcategories",authenticate, societyController.getBySubcategories);
router.get("/getByType",authenticate, societyController.getByType);
router.get("/getBySocietyId/:societyId",authenticate, societyController.getBySocietyId);
router.get("/getByUniversityId",authenticate,authorizeRole(["MAINTAINER"]), societyController.getByUniversityId);
router.post("/joinSocieties",authenticate, societyController.joinSocieties);
router.post("/leaveSociety",authenticate, societyController.leaveSociety);

// router.post("/delete-image", societyController.deleteImage);

export default router;