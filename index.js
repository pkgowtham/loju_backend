import dotenv from "dotenv";
dotenv.config();

import express from "express";
// import cors from "cors";
import ConnectDB from "./db/index.js";

import authRoutes from "./route/auth.js";
import adminRoutes from "./route/admin.js";
import universityRoutes from "./route/university.js";
import studentRoutes from "./route/student.js";
import categoryRoutes from "./route/category.js";
import subcategoryRoutes from "./route/subcategory.js";
import studentWithSubcategoryRoutes from "./route/studentWithSubcategory.js";
import societyRoutes from "./route/society.js";
import postRoutes from "./route/post.js";
import eventRoutes from "./route/event.js";
import companyRoutes from "./route/company.js";
import offerRoutes from "./route/offer.js";
import maintainerRoutes from "./route/maintainer.js";
import reportRoutes from "./route/report.js";
import notificationSettingRoutes from "./route/notificationSetting.js"
import feedRoutes from "./route/feed.js"
import feedBackRoutes from "./route/feedBack.js"

import notificationRoutes from "./route/notification.js"
import chatGroupsRoutes from "./route/chatGroups.js"

import healthRoutes from "./route/health.js"
import messageRoutes from "./route/message.js";
import societyAnnouncementRoutes from "./route/societyAnnouncement.js";
import reminderEventRoutes from "./route/reminderEvent.js";
import { errorHandler } from "./utils/errorHandler.js";

// import swaggerJsdoc from "swagger-jsdoc";
// import swaggerUi from "swagger-ui-express";
// import { swaggerOptions } from "./swaggerOptions.js";

// const specs = swaggerJsdoc(swaggerOptions);







const app = express();
app.use(express.json());
// app.use(cors());
ConnectDB();


// app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));
// app.use("/api/api/v1/auth", authRoutes);
app.use("/v1/health/",healthRoutes );
app.use("/v1/auth/", authRoutes);
app.use("/v1/admin/", adminRoutes);
app.use("/v1/university/", universityRoutes);
app.use("/v1/student/", studentRoutes);
app.use("/v1/category/", categoryRoutes);
app.use("/v1/subcategory/", subcategoryRoutes);
app.use("/v1/studentWithSubcategory/", studentWithSubcategoryRoutes);
app.use("/v1/society/", societyRoutes);
app.use("/v1/post/", postRoutes);
app.use("/v1/event/", eventRoutes);
app.use("/v1/company/", companyRoutes);
app.use("/v1/offer/", offerRoutes);
app.use("/v1/maintainer/", maintainerRoutes);
app.use("/v1/report/", reportRoutes);
app.use("/v1/notificationSetting/",notificationSettingRoutes)
app.use("/v1/feed/",feedRoutes)
app.use("/v1/feedBack/",feedBackRoutes)

app.use("/v1/notificationSetting/",notificationSettingRoutes);
app.use("/v1/notification/",notificationRoutes);
app.use("/v1/chatGroups/",chatGroupsRoutes);



app.use("/v1/message/", messageRoutes);
app.use("/v1/societyAnnouncement/", societyAnnouncementRoutes);
app.use("/v1/reminderEvent/", reminderEventRoutes);



app.use(errorHandler);

app.listen(process.env.PORT, console.log(`Im working at ${process.env.PORT}`));

