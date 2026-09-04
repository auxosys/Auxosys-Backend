/**
 * emailTransport.js
 *
 * Pluggable Email Delivery Provider Strategy.
 * Default provider: Gmail / Google Workspace SMTP (via existing smtpService.js).
 * Future providers (SendGrid, AWS SES, Custom SMTP) can register their drivers here
 * without modifying campaign execution or queue logic.
 */

const { sendMail: sendSmtpMail } = require('./smtpService');

class GmailSmtpProvider {
  constructor(name = 'gmail_smtp') {
    this.name = name;
  }

  async send({ mailboxRow, supabase, message }) {
    // Delegates to smtpService.js which handles OAuth2 refresh tokens & app passwords
    return await sendSmtpMail(mailboxRow, supabase, message);
  }
}

/**
 * Strategy Manager for Email Transports.
 */
class EmailTransportManager {
  constructor() {
    this.providers = new Map();
    // Register default Gmail/Workspace SMTP provider
    this.registerProvider('gmail', new GmailSmtpProvider('gmail'));
    this.registerProvider('other', new GmailSmtpProvider('other_smtp'));
  }

  registerProvider(key, providerInstance) {
    this.providers.set(key.toLowerCase(), providerInstance);
  }

  getProvider(providerKey = 'gmail') {
    const key = (providerKey || 'gmail').toLowerCase();
    if (this.providers.has(key)) {
      return this.providers.get(key);
    }
    // Fallback to default Gmail SMTP if unknown key provided
    return this.providers.get('gmail');
  }

  /**
   * Unified send method called by Campaign Queue Worker.
   */
  async sendMail({ mailboxRow, supabase, message }) {
    const provider = this.getProvider(mailboxRow.provider);
    return await provider.send({ mailboxRow, supabase, message });
  }
}

const transportManager = new EmailTransportManager();

module.exports = {
  EmailTransportManager,
  transportManager,
};
