import ChatGroups from "../model/chatGroups.js";
import axios from "axios";
import Society from "../model/society.js";
import { handleMultipartUpload } from "../utils/s3Upload.js";

const BASE_URL = `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;


/* export const broadcastAdminMessage = async (req, res) => {
  try {

    const parsed = await handleMultipartUpload(req, {
      maxFileSize: 20 * 1024 * 1024, // 5MB
      maxFileCount: 1,
    });

    const { societyId, adminId, message = "" } = parsed;

    if (!societyId || !adminId || (!message && !parsed.file)) {
      return res.status(400).json({ 
        message: "Missing required fields: societyId, adminId, or message/file" 
      });
    }

    // Step 2: Get society and validate admin
    const society = await Society.findOne({ _id: societyId, adminId }).populate("adminId");

    if (!society) {
      return res.status(403).json({ 
        message: "Not authorized or society not found" 
      });
    }

    const adminUser = {
      user_id: society.adminId._id.toString(),
      nickname: `${society.adminId.firstName} ${society.adminId.lastName}`,
      profile_url: society.adminId.avatar || ""
    };

    // Step 3: Ensure admin exists in Sendbird
    try {
      await axios.get(`${BASE_URL}/users/${adminUser.user_id}`, {
        headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN }
      });
    } catch (err) {
      if (err.response?.status === 404) {
        await axios.post(`${BASE_URL}/users`, adminUser, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN }
        });
      } else {
        throw err;
      }
    }

    // Step 4: Get chat groups
    const chatGroups = await ChatGroups.find({ societyId });
    if (chatGroups.length === 0) {
      return res.status(404).json({ message: "No chat groups found for this society" });
    }

    // Step 5: Extract uploaded image file URL (if any)
    const file = parsed.file || parsed.files || parsed.attachment || null;
    const files = Array.isArray(file) ? file : file ? [file] : [];

    // Step 6: Send broadcast message to each channel
    const results = await Promise.allSettled(
      chatGroups.map(async (group) => {
        const channelUrl = group.channels;
        if (!channelUrl) return { status: 'skipped', reason: 'No channel URL' };

        try {
          const payload = {
            message_type: "MESG",
            user_id: adminUser.user_id,
            message: `[ADMIN] ${message || "📎 Attachment"}`,
            custom_type: "admin_broadcast",
            data: JSON.stringify({
              societyId: society._id.toString(),
              timestamp: new Date().toISOString(),
              files, // <-- image URLs
            })
          };

          const response = await axios.post(
            `${BASE_URL}/group_channels/${channelUrl}/messages`,
            payload,
            {
              headers: {
                "Api-Token": process.env.SENDBIRD_API_TOKEN,
                "Content-Type": "application/json"
              }
            }
          );

          return {
            status: 'success',
            channelUrl,
            data: response.data
          };

        } catch (error) {
          console.error(`Send error to ${channelUrl}:`, error.response?.data || error.message);
          return {
            status: 'failed',
            channelUrl,
            error: error.response?.data || error.message
          };
        }
      })
    );

    // Step 7: Format results
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    return res.status(200).json({
      message: "Broadcast completed",
      stats: {
        total: chatGroups.length,
        successful: successful.length,
        failed: failed.length
      },
      details: {
        successful: successful.map(s => ({
          channelUrl: s.channelUrl,
          messageId: s.data?.message_id
        })),
        failed: failed.map(f => ({
          channelUrl: f.channelUrl,
          error: f.error
        }))
      }
    });

  } catch (error) {
    console.error("Broadcast error:", error);
    return res.status(500).json({
      message: "Failed to broadcast message",
      error: error.response?.data || error.message
    });
  }
}; */

export const broadcastAdminMessage = async (req, res) => {
  try {
    const parsed = await handleMultipartUpload(req, {
      maxFileSize: 20 * 1024 * 1024, // 5MB
      maxFileCount: 1,
    });

    const { societyId, adminId, message = "" } = parsed;

    if (!societyId || !adminId || (!message && !parsed.file)) {
      return res.status(400).json({
        message: "Missing required fields: societyId, adminId, or message/file",
      });
    }

    // Step 2: Get society and validate admin
    const society = await Society.findOne({ _id: societyId, adminId }).populate(
      "adminId"
    );

    if (!society) {
      return res.status(403).json({
        message: "Not authorized or society not found",
      });
    }

    const adminUser = {
      user_id: society.adminId._id.toString(),
      nickname: `${society.adminId.firstName} ${society.adminId.lastName}`,
      profile_url: society.adminId.avatar || "",
    };

    // Step 3: Ensure admin exists in Sendbird
    try {
      await axios.get(`${BASE_URL}/users/${adminUser.user_id}`, {
        headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
      });
    } catch (err) {
      if (err.response?.status === 404) {
        await axios.post(`${BASE_URL}/users`, adminUser, {
          headers: { "Api-Token": process.env.SENDBIRD_API_TOKEN },
        });
      } else {
        throw err;
      }
    }

    // Step 4: Get chat groups
    const chatGroups = await ChatGroups.find({ societyId });
    if (chatGroups.length === 0) {
      return res
        .status(404)
        .json({ message: "No chat groups found for this society" });
    }

    // Step 5: Prepare file data if exists
    let fileUrl = null;
    let fileData = null;

    if (parsed.file) {
      // The file URL comes directly from the parsed object
      fileUrl = Array.isArray(parsed.file) ? parsed.file[0] : parsed.file;

      if (!fileUrl) {
        throw new Error("File URL is required");
      }

      
      fileData = {
        url: fileUrl,
        name: "file", 
        size: 0, 
        type: "application/octet-stream", 
      };
    }

    // Step 6: Send broadcast message to each channel
    const results = await Promise.allSettled(
      chatGroups.map(async (group) => {
        const channelUrl = group.channels;
        if (!channelUrl) return { status: "skipped", reason: "No channel URL" };

        try {
          let payload;

          payload = {
            message_type: "MESG",
            user_id: adminUser.user_id,
            message: `[ADMIN] ${message}`,
            custom_type: "admin_broadcast",
            data: JSON.stringify({
              societyId: society._id.toString(),
              timestamp: new Date().toISOString(),
              file: 
                {
                  url: fileUrl,
                  name: fileData.name,
                  size: fileData.size,
                  type: fileData.type,
                },
            }),
          };

          const response = await axios.post(
            `${BASE_URL}/group_channels/${channelUrl}/messages`,
            payload,
            {
              headers: {
                "Api-Token": process.env.SENDBIRD_API_TOKEN,
                "Content-Type": "application/json",
              },
            }
          );

          return {
            status: "success",
            channelUrl,
            data: response.data,
          };
        } catch (error) {
          console.error(
            `Send error to ${channelUrl}:`,
            error.response?.data || error.message
          );
          return {
            status: "failed",
            channelUrl,
            error: error.response?.data || error.message,
          };
        }
      })
    );

    // Step 7: Format results
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "success"
    );
    const failed = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "failed"
    );

    return res.status(200).json({
      message: "Broadcast completed",
      stats: {
        total: chatGroups.length,
        successful: successful.length,
        failed: failed.length,
      },
      details: {
        successful: successful.map((s) => ({
          channelUrl: s.value.channelUrl,
          messageId: s.value.data?.message_id,
        })),
        failed: failed.map((f) => ({
          channelUrl: f.value.channelUrl,
          error: f.value.error,
        })),
      },
    });
  } catch (error) {
    console.error("Broadcast error:", error);
    return res.status(500).json({
      message: "Failed to broadcast message",
      error: error.message,
    });
  }
};
