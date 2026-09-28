import Student from "../model/student.js";
import axios from 'axios';



export const fetchMessagesFromChannel = async (channelUrl) => {
  if (!channelUrl || typeof channelUrl !== 'string') {
    throw new Error('Channel URL is required and must be a string');
  }

  const SEND_BIRD_APP_ID = process.env.SENDBIRD_APP_ID;
  const API_TOKEN = process.env.SENDBIRD_API_TOKEN;

  if (!SEND_BIRD_APP_ID || !API_TOKEN) {
    throw new Error('Sendbird credentials not configured');
  }

  const url = `https://api-${SEND_BIRD_APP_ID}.sendbird.com/v3/group_channels/${encodeURIComponent(channelUrl)}/messages?message_ts=0&prev_limit=50`;

  try {
    const response = await axios.get(url, {
      headers: {
        "Api-Token": API_TOKEN,
        "Content-Type": "application/json"
      }
    });
    return response.data.messages || [];
  } catch (error) {
    console.error('Sendbird API Error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }
};

export const getStudentMessagesFromAllGroups = async (studentId, allowedChannels = []) => {
  try {
    const student = await Student.findById(studentId).populate({
      path: 'chats',
      select: 'name channels',
      match: {
        channels: { $in: allowedChannels } // only fetch chats matching given channels
      }
    });

    if (!student) throw new Error('Student not found');
    if (!student.chats?.length) return [];

    const allMessages = await Promise.all(
      student.chats.map(async (chat) => {
        try {
          const messages = await fetchMessagesFromChannel(chat.channels);
          return {
            groupName: chat.name,
            channelUrl: chat.channels,
            messages
          };
        } catch (error) {
          return {
            groupName: chat.name,
            channelUrl: chat.channels,
            messages: [],
            error: error.message
          };
        }
      })
    );

    return allMessages;
  } catch (error) {
    console.error('Error in getStudentMessagesFromAllGroups:', error);
    throw error;
  }
};
