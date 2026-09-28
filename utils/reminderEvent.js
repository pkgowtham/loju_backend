// reminderCron.js
import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
import { Expo } from "expo-server-sdk";
import mongoose from "mongoose";
import StudentWithEvent from "../model/studentWithEvent.js";
import Event from "../model/event.js";
import User from "../model/user.js";

const expo = new Expo();

export function setupEventReminderCronJob() {
  
  cron.schedule("0 8 * * *", async () => {
    await sendEventReminders();
  }, {
  timezone: "Europe/London"
});
}

export async function sendEventReminders() {
  try {
    // Debug: Count all events in database
    const totalEventsCount = await Event.countDocuments();
    console.log(`Total events in database: ${totalEventsCount}`);

    // const now = dayjs();
    const now = dayjs().tz("Europe/London");

    const startOfToday = now.startOf("day");

    // Find upcoming events
    const upcomingEvents = await Event.find({
      startingTime: {
        $gte: startOfToday.toDate(),
      },
      display: true,
    }).sort({ startingTime: 1 });

    if (upcomingEvents.length === 0) {
      console.log("No upcoming events found.");
      return;
    }

    for (const event of upcomingEvents) {
      // Find all students linked to this event who are allowed to go
      const studentLinks = await StudentWithEvent.find({
        eventId: event._id,
        allow: true,
        going: true,
      }).populate("studentId");

      const studentIds = studentLinks.map(
        (link) => link.studentId._id ?? link.studentId
      );

      if (studentIds.length === 0) {
        continue;
      }

      const students = await User.find({
        details: { $in: studentIds },
      }).populate({
        path: "details",
        model: "Student",
        select: "notificationToken firstName ",
      });
      const validStudents = students.filter((s) =>
        Expo.isExpoPushToken(s.notificationToken)
      );

      if (validStudents.length === 0) continue;

      // Send push notifications
      for (const student of validStudents) {
        console.log(student.details?.name);
        const message = {
          to: student.notificationToken,
          sound: "default",
          title: `Upcoming Event: ${event.name}`,
          body: `Your event "${event.name}" starts at ${dayjs(
            event.startingTime
          ).format("hh:mm A")} ends at ${dayjs(
            event.endingTime
          ).format("hh:mm A")} at ${event.location}`,
          data: {
            type: "EVENT_REMINDER",
            eventId: event._id.toString(),
          },
          channelId: "default",
        };

        try {
          const ticket = await expo.sendPushNotificationsAsync([message]);
          console.log(`✅ Notification sent to students`);
          console.log(`Ticket: ${JSON.stringify(ticket)}`);
        } catch (err) {
          console.error(`❌ Failed to send to students:`, err);
        }
      }
    }

    // console.log(
    //   `✅ Event reminders completed for ${upcomingEvents.length} events`
    // );
  } catch (err) {
    console.error("❌ Error in event reminder cron job:", err);
  }
}

// Start the cron job (adjust based on environment)
if (process.env.NODE_ENV === "development") {
  setupEventReminderCronJob();
}

/* export function setupEventReminderCronJob() {
  // Run every minute to check for events starting soon
  cron.schedule("48 15 * * *", async () => {
    console.log("Checking for upcoming events...");
    await sendEventReminders();
  });
}

export async function sendEventReminders() {
  try {
    console.log("Running EVENT reminder job...");
    console.log("Current time:", dayjs().format("YYYY-MM-DD HH:mm:ss"));

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log("Waiting for MongoDB connection...");
      return;
    }

    // Debug: Count all events in database
    const totalEventsCount = await Event.countDocuments();
    console.log(`Total events in database: ${totalEventsCount}`);

    // Current date-time (local)
    const now = dayjs();

    const startOfToday = now.startOf("day");
    console.log("Query time (local):", now.format("YYYY-MM-DD HH:mm:ss"));

    // Find upcoming events
    const upcomingEvents = await Event.find({
      startingTime: {
        $gte: startOfToday.toDate(),
      },
      display: true,
    }).sort({ startingTime: 1 });

    // Debug: Log all events to see what's in the database
    const allEvents = await Event.find({}).sort({ startingTime: 1 });
    console.log("\nAll events in database:");
    allEvents.forEach((event) => {
      const eventTime = dayjs(event.startingTime);
      console.log(
        `- ${event.name} (ID: ${event._id}, starts: ${eventTime.format(
          "YYYY-MM-DD HH:mm:ss"
        )}, display: ${event.display})`
      );
    });

    console.log(`\nFound ${upcomingEvents.length} upcoming events:`);
    upcomingEvents.forEach((event) => {
      const eventTime = dayjs(event.startingTime);
      console.log(
        `- ${event.name} (starts: ${eventTime.format("YYYY-MM-DD HH:mm:ss")})`
      );
    });

    if (upcomingEvents.length === 0) {
      console.log("No upcoming events found.");
      return;
    }

    for (const event of upcomingEvents) {
      console.log(`\nProcessing event: ${event.name}`);

      // Find all students linked to this event who are allowed to go
      const studentLinks = await StudentWithEvent.find({
        eventId: event._id,
        allow: true,
        going: true,
      }).populate("studentId");

      console.log(`Found ${studentLinks.length} student links for this event`);

      const studentIds = studentLinks.map(
        (link) => link.studentId._id ?? link.studentId
      );

      if (studentIds.length === 0) {
        console.log("No students registered for this event");
        continue;
      }

      const students = await User.find({
        details: { $in: studentIds },
      }).populate({
        path: "details",
        model: "Student",
        select: "notificationToken name", // pick needed fields
      });

      console.log(`Found ${students.length} users with details populated`);

      console.log(`Found ${students.length} users with notification tokens`);

      const validStudents = students.filter((s) =>
        Expo.isExpoPushToken(s.notificationToken)
      );

      console.log(`Found ${validStudents.length} users with valid Expo tokens`);

      if (validStudents.length === 0) continue;

      // Send push notifications
      for (const student of validStudents) {
        const message = {
          to: student.notificationToken,
          sound: "default",
          title: `Upcoming Event: ${event.name}`,
          body: `Your event "${event.name}" starts at ${dayjs(
            event.startingTime
          ).format("hh:mm A")} at ${event.location}`,
          data: {
            type: "EVENT_REMINDER",
            eventId: event._id.toString(),
          },
          channelId: "default",
        };

        try {
          const ticket = await expo.sendPushNotificationsAsync([message]);
          console.log(`✅ Notification sent to ${student.name}`);
          console.log(`Ticket: ${JSON.stringify(ticket)}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${student.name}:`, err);
        }
      }
    }

    console.log(
      `✅ Event reminders completed for ${upcomingEvents.length} events`
    );
  } catch (err) {
    console.error("❌ Error in event reminder cron job:", err);
  }
}

// Start the cron job (adjust based on environment)
if (process.env.NODE_ENV === "development") {
  setupEventReminderCronJob();
} */
