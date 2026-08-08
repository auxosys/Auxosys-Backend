const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleIndexingService {
  constructor() {
    this.keyFilePath = path.join(__dirname, '../google-credentials.json');
    this.isConfigured = fs.existsSync(this.keyFilePath);
  }

  async getAuthClient() {
    if (!this.isConfigured) {
      throw new Error("Google Indexing API is not configured (missing google-credentials.json)");
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFilePath,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    return auth.getClient();
  }

  async notifyGoogle(url, type = 'URL_UPDATED') {
    // type can be 'URL_UPDATED' or 'URL_DELETED'
    try {
      const authClient = await this.getAuthClient();
      const indexing = google.indexing({ version: 'v3', auth: authClient });
      
      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: type,
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Google Indexing API Error:', error);
      return { success: false, message: error.message || "Failed to notify Google" };
    }
  }
}

module.exports = new GoogleIndexingService();
