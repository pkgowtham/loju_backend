import Student from "../model/student.js";
import ChatGroups from "../model/chatGroups.js";
import axios from "axios";
import { handleMultipartUpload } from "../utils/s3Upload.js";
import { joinChannel } from "../utils/joinChannel.js";
import { getStudentMessagesFromAllGroups } from "../utils/groupMessage.js";
const SENDBIRD_API_TOKEN = process.env.SENDBIRD_API_TOKEN;
const SENDBIRD_APP_ID = process.env.SENDBIRD_APP_ID;

const sendbirdAPI = axios.create({
  baseURL: `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3`,
  headers: {
    'Api-Token': SENDBIRD_API_TOKEN,
    'Content-Type': 'application/json',
  },
});


// ✅ 1. Send message for each group message 
export const sendMessage = async (req, res) => {
  try {
    const parsed = await handleMultipartUpload(req, {
      maxFileSize: 20 * 1024 * 1024, // 5MB
      maxFileCount: 3,
    }, "message");

    const { senderId, channelUrl, messageText = "" } = parsed;

    if (!senderId || !channelUrl || (!messageText && !parsed.file)) {
      throw new CustomError("Missing required fields", 400);
    }

    const channel = await joinChannel(senderId, channelUrl);
    if (!channel.sb) throw new Error("SendBird instance not attached");

    const metadata = {};
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && key !== "file") {
        metadata[key] = parsed[key];
      }
    }

    // Attach file URLs if present
    const files = parsed.file || parsed.files || parsed.attachment || null;
    if (files) metadata.files = files;

    const params = new channel.sb.UserMessageParams();
    params.message = messageText || "📎 Attachment";
    if (Object.keys(metadata).length > 0) {
      params.data = JSON.stringify(metadata);
    }

    const sendbirdMessage = await new Promise((resolve, reject) => {
      channel.sendUserMessage(params, (message, error) => {
        if (error) reject(error);
        else resolve(message);
      });
    });

    res.status(200).json({ message: "Message sent", sendbirdMessage });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// ✅ 2. Getlist  Student Join a List Of Groups 
export const getStudentGroupsWithChannels = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findById(studentId).populate({
      path: 'chats',
      model: 'ChatGroups',
      populate: {
        path: 'societyId',
        model: 'Society',
        select: 'name logo banner',
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Filter out chats without channel URLs
    const validChats = student.chats.filter(chat => chat?.channels);

    const channels = await Promise.all(
      validChats.map(async (chat) => {
        let lastMessageText = '';
        let lastMessageTime = null;
        let unreadCount = 0;
        let isRead = true; // Default to true (no unread messages)

        try {
          // 1. Fetch last message with read receipts
          const messagesRes = await sendbirdAPI.get(
            `/group_channels/${chat.channels}/messages`,
            {
              params: {
                message_ts: Date.now(),
                prev_limit: 1,
                include: true,
                reverse: true,
                show_read_receipt: true // Important for isRead status
              },
            }
          );

          const lastMessage = messagesRes.data.messages?.[0];
          if (lastMessage) {
            lastMessageText = lastMessage.message || '';
            lastMessageTime = new Date(lastMessage.created_at);
            
            // 2. Check if last message has been read by this user
            if (lastMessage.read_receipt && lastMessage.read_receipt.users) {
              isRead = lastMessage.read_receipt.users.some(user => user.user_id === studentId);
            }
          }

          // 3. Get unread count (using the most reliable method)
          try {
            const unreadRes = await sendbirdAPI.get(
              `/group_channels/${chat.channels}/messages/unread_count`,
              {
                params: {
                  user_id: studentId
                }
              }
            );
            unreadCount = unreadRes.data?.unread_count || 0;
            
            // If we have unread messages, override isRead
            if (unreadCount > 0) {
              isRead = false;
            }
          } catch (unreadErr) {
            // console.error(`Unread count error for ${chat.channels}:`, unreadErr.response?.data || unreadErr.message);
            
            // Fallback to check channel unread status
            try {
              const channelStatus = await sendbirdAPI.get(
                `/group_channels/${chat.channels}`,
                {
                  params: {
                    show_read_receipt: true,
                    user_id: studentId
                  }
                }
              );
              
              if (channelStatus.data.unread_message_count > 0) {
                unreadCount = channelStatus.data.unread_message_count;
                isRead = false;
              }
            } catch (channelErr) {
              // console.error(`Channel status error for ${chat.channels}:`, channelErr.response?.data || channelErr.message);
            }
          }

        } catch (err) {
          // console.error(`Error processing channel ${chat.channels}:`, err.response?.data || err.message);
        }

        return {
          name: chat.name,
          society: chat.societyId?.name || null,
          logo: chat.societyId?.logo || null,
          banner: chat.societyId?.banner || null,
          channelUrl: chat.channels,
          lastMessageText,
          lastMessageTime,
          unreadCount,
          isRead,
        };
      })
    );

    res.json({ channels });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch student channels' });
  }
};

// ✅ 3. Get  Student Join a  Group Of Message list  
export const getStudentMessagesFromAllGroupsController = async (req, res) => {
  const { studentId, channels } = req.params;

  try {
    if (!studentId || !channels) {
      return res.status(400).json({
        success: false,
        message: "Missing studentId or channels in request parameters"
      });
    }

    const channelList = channels.split(',').map(ch => ch.trim()).filter(Boolean); // clean list

    // This should return:
    // [
    //   { groupName, channelUrl, messages: [msg, msg, ...] },
    //   ...
    // ]
    const groupedMessages = await getStudentMessagesFromAllGroups(studentId, channelList);

    const finalOutput = await Promise.all(groupedMessages.map(async (group) => {
       const chatGroup = await ChatGroups.findOne({ 
        channels: group.channelUrl 
      }).populate('societyId', 'name logo banner');

      const enhancedMessages = group.messages.map(msg => {
        let parsedData = {};
        try {
          if (msg.data) parsedData = JSON.parse(msg.data);
        } catch (err) {
          console.warn(`Invalid JSON in message ${msg.message_id}:`, msg.data);
        }

        return {
          ...msg,
          files: parsedData.files || [],
          fileUrl: parsedData.fileUrl || null
        };
      });

      return {
        groupName: group.groupName,
        channelUrl: group.channelUrl,
         society: chatGroup?.societyId ? {
          name: chatGroup.societyId.name,
          logo: chatGroup.societyId.logo || null,
          banner: chatGroup.societyId.banner || null
        } : null,
        messages: enhancedMessages
      };
    }));

    res.status(200).json({
      success: true,
      data: finalOutput,
      count: finalOutput.length
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch messages',
      data: []
    });
  }
};

// ✅ 4. Patch  Marked as message Read
export const markChannelAsRead = async (req, res) => {
  const { studentId, channelUrl } = req.params;

  try {
    // 1. First verify the channel exists and user is a member
    const channelInfo = await sendbirdAPI.get(
      `/group_channels/${channelUrl}`,
      {
        params: {
          show_member: true,
          user_id: studentId
        }
      }
    );

    if (!channelInfo.data.members.some(member => member.user_id === studentId)) {
      return res.status(404).json({
        error: 'User is not a member of this channel',
        channelUrl,
        studentId
      });
    }

    // 2. Mark all messages as read
    const markReadResponse = await sendbirdAPI.put(
      `/group_channels/${channelUrl}/messages/mark_as_read`,
      {
        user_id: studentId,
        timestamp: Date.now() // Mark all messages up to now as read
      }
    );

    // 3. Verify the unread count was reset (using multiple methods)
    let verificationPassed = false;
    let unreadCount = 1; // Default to 1 (will be updated)
    
    // Method 1: Direct channel unread count
    try {
      const channelStatus = await sendbirdAPI.get(
        `/group_channels/${channelUrl}`,
        {
          params: {
            show_unread_count: true,
            user_id: studentId
          }
        }
      );
      unreadCount = channelStatus.data.unread_message_count || 0;
      verificationPassed = unreadCount === 0;
    } catch (verificationError) {
      console.error('Primary verification failed:', verificationError.message);
    }

    // Method 2: User's unread count for channel (fallback)
    if (!verificationPassed) {
      try {
        const unreadRes = await sendbirdAPI.get(
          `/users/${studentId}/unread_message_count`,
          {
            params: {
              channel_urls: channelUrl,
              detailed: true
            }
          }
        );
        
        // Handle different response formats
        if (Array.isArray(unreadRes.data.unread)) {
          unreadCount = unreadRes.data.unread.find(c => c.channel_url === channelUrl)?.unread_message_count || 0;
        } else {
          unreadCount = unreadRes.data?.unread[channelUrl] || 0;
        }
        verificationPassed = unreadCount === 0;
      } catch (fallbackError) {
        console.error('Fallback verification failed:', fallbackError.message);
      }
    }

    // 4. Return appropriate response
    if (verificationPassed) {
      res.json({
        success: true,
        channelUrl,
        isRead: true,
        unreadCount: 0,
        message: 'All messages marked as read successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(207).json({ // 207 Multi-Status
        success: false,
        channelUrl,
        isRead: false,
        unreadCount,
        message: 'Messages marked as read but verification failed',
        warning: 'Unread count may not be accurate',
        timestamp: new Date().toISOString()
      });
    }

  } catch (err) {
    console.error(`Error marking channel ${channelUrl} as read:`, err.response?.data || err.message);
    
    const errorResponse = {
      error: 'Failed to mark channel as read',
      channelUrl,
      studentId,
      details: err.response?.data || err.message,
      timestamp: new Date().toISOString()
    };

    // Special handling for common errors
    if (err.response?.data?.code === 400201) {
      errorResponse.error = 'Channel not found';
      res.status(404).json(errorResponse);
    } else if (err.response?.data?.code === 400105) {
      errorResponse.error = 'Invalid user ID';
      res.status(400).json(errorResponse);
    } else {
      res.status(500).json(errorResponse);
    }
  }
};