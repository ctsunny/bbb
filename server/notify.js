const axios = require('axios');
const db = require('./db');

const sendBarkNotification = async (title, content, url = '') => {
  try {
    const barkKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('bark_key')?.value;
    if (!barkKey) {
      console.warn('Bark key not set, skipping notification.');
      return;
    }

    const encodedTitle = encodeURIComponent(title);
    const encodedContent = encodeURIComponent(content);
    const encodedUrl = url ? `?url=${encodeURIComponent(url)}` : '';
    
    // Bark format: https://api.day.app/{key}/{title}/{content}?url={url}
    const barkUrl = `https://api.day.app/${barkKey}/${encodedTitle}/${encodedContent}${encodedUrl}`;
    
    await axios.get(barkUrl);
    console.log(`Notification sent for: ${title}`);
  } catch (error) {
    console.error('Bark notification error:', error.message);
  }
};

module.exports = { sendBarkNotification };
