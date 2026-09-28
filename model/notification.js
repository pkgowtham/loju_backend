import mongoose, { Schema } from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            ref: "Student",
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "Student", 
        },
        type: {
            type: String,
            enum: {
                values: ["MESSAGE", "EVENT", "SOCIETY", "OFFER","POST"],
                message: "{VALUE} is not supported",
            },
            required: true,
        },
        messageContent: {
            type: String,
        },
        messageUrl: {
            type: String,
        },

        eventId: {
            type: Schema.Types.ObjectId,
            ref: "Event",
        },
        societyId: {
            type: Schema.Types.ObjectId,
            ref: "Society",
        },
        offerId: {
            type: Schema.Types.ObjectId,
            ref: "Offer",
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: "Post",
        },
        eventUrl: {
            type: String,
        },

        societyUrl: {
            type: String,
        },

        offerUrl: {
            type: String,
        },

        postUrl: {
            type: String,
        },

        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

// studentId. - req.body.sender. user_id
// senderId -- req.body.sender. user_id
// type - MESSAGE
// messageContent - req.body.payload.message
// messageUrl -  req.body.payload.url


