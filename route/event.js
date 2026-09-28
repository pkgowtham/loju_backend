import express from "express";
import * as controller from "../controller/event.js";
import { authenticate, authorizeRole } from "../middleware/authentication.js"

const router = express.Router();

router.post("/", authenticate, authorizeRole("STUDENT"), controller.create);
router.patch("/:id", authenticate, authorizeRole("STUDENT"), controller.update);
router.get("/getByUniversityId", authenticate, authorizeRole(["MAINTAINER"]), controller.getByUniversityId);
router.get("/getByUpcoming", authenticate, authorizeRole("STUDENT"), controller.getByUpcoming);
router.get("/getById/:id", authenticate, authorizeRole("STUDENT"), controller.getById);

router.get("/:societyId", authenticate, authorizeRole("STUDENT"), controller.getBySocietyId);
router.delete("/:id", authenticate, authorizeRole(["STUDENT", "MAINTAINER"]), controller.destroy);
router.post("/joinEvent", authenticate, authorizeRole("STUDENT"), controller.joinEvent);
router.post("/toggleGoingStatus", authenticate, authorizeRole("STUDENT"), controller.toggleGoingStatus);






export default router;


