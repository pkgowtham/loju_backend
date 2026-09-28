import express from "express";
import * as controller from "../controller/offer.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js";

const router = express.Router();

router.post("/", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.create);
router.patch("/:id", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.update);
router.delete("/:id", authenticate, authorizeRole(["ADMIN", "MAINTAINER"]), controller.destroy);
router.get("/getByUniversityId", authenticate, authorizeRole(["MAINTAINER"]),controller.getByUniversityId);
router.get("/:offerId", controller.getById);
router.get("/", authenticate, authorizeRole(["ADMIN","STUDENT"]),controller.getList);
router.post("/redeem", authenticate, authorizeRole(["STUDENT"]), controller.redeemOffer);

export default router;