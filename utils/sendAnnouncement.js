// // utils/sendAnnouncement.js
// import SendBird from 'sendbird';
// const APP_ID = process.env.SENDBIRD_APP_ID;

// export const sendAnnouncementToAllChannels = async (adminUserId, announcementText) => {
//   const sb = new SendBird({ appId: APP_ID });

//   try {
//     // Step 1: Connect as admin
//     await new Promise((resolve, reject) => {
//       sb.connect(adminUserId, (user, err) => {
//         if (err) reject(err);
//         else resolve(user);
//       });
//     });

//     // Step 2: List all group channels
//     const channels = await new Promise((resolve, reject) => {
//       const listQuery = sb.GroupChannel.createMyGroupChannelListQuery();
//       listQuery.includeEmpty = true;
//       listQuery.limit = 100; // Adjust based on channel count
//       listQuery.next((channels, error) => {
//         if (error) reject(error);
//         else resolve(channels);
//       });
//     });

//     // Step 3: Send announcement to each channel
//     const results = await Promise.all(
//       channels.map(channel => {
//         return new Promise((resolve) => {
//           const params = new sb.UserMessageParams();
//           params.message = announcementText;
//           params.customType = 'admin_announcement'; // Mark as admin message
          
//           channel.sendUserMessage(params, (message, error) => {
//             if (error) resolve({ success: false, channelUrl: channel.url, error });
//             else resolve({ success: true, channelUrl: channel.url, message });
//           });
//         });
//       })
//     );

//     return results;
//   } catch (err) {
//     throw new Error(`Announcement failed: ${err.message}`);
//   }
// };