import SendBird from 'sendbird';

const APP_ID = process.env.SENDBIRD_APP_ID;

export const joinChannel = (userId, channelUrl) => {
  return new Promise((resolve, reject) => {
    const sb = new SendBird({ appId: APP_ID });

    sb.connect(userId, (user, err) => {
      if (err) return reject(new Error(`Failed to connect: ${err.message}`));

      sb.GroupChannel.getChannel(channelUrl, (channel, error) => {
        if (error) return reject(new Error(`Failed to get channel: ${error.message}`));
        
        // Attach the SendBird instance to the channel
        channel.sb = sb;  // <-- This ensures `channel.sb` exists
        resolve(channel);
      });
    });
  });
};