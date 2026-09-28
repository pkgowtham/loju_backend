import express from "express";
import * as categoryController from "../controller/category.js";
import {authenticate,authorizeRole} from "../middleware/authentication.js"

const router = express.Router();

router.post("/",authenticate,authorizeRole(["ADMIN"]), categoryController.create);
router.post("/categoryCsv",authenticate,authorizeRole(["ADMIN"]), categoryController.createFromCSV);
router.get("/",authenticate, categoryController.getList);
router.patch("/:id",authenticate,authorizeRole(["ADMIN"]), categoryController.update);
router.delete("/:id",authenticate,authorizeRole(["ADMIN"]), categoryController.destroy);

export default router;











// // routes/announcement.js
// import express from "express";
// import * as controller from "../controller/announcement.js";

// const router = express.Router();

// router.post("/", controller.create);
// router.patch("/:announcementId", controller.update);
// router.delete("/:announcementId", controller.destroy);
// router.post("/delete-images", controller.deleteImages);

// export default router;


// // routes/studentEvent.js
// import express from "express";
// import * as controller from "../controller/studentEvent.js";

// const router = express.Router();

// router.get("/feed", controller.getFeedForStudent);
// router.get("/society", controller.getSocietyFeedByType);
// router.post("/join", controller.joinEvent);
// router.post("/leave", controller.leaveEvent);
// router.get("/:eventId", controller.getEventDetails);
// router.patch("/notification", controller.updateNotificationFlag);

// export default router;
