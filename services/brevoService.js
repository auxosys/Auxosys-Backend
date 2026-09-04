/**
 * brevoService.js
 *
 * Centralized Brevo Email Infrastructure Service.
 * Handles API & SMTP delivery via Brevo, sender status verification sync,
 * and webhook event processing for real-time delivery tracking.
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey() {
  return process.env.BREVO_API_KEY;
}

/**
 * Sends a transactional or outreach email via Brevo API / SMTP.
 */
async function sendEmail({ senderName, senderEmail, recipientEmail, subject, htmlContent, textContent, replyTo, tags, attachments }) {
  const apiKey = getApiKey();

  const brevoAttachments = (attachments || []).map(a => ({
    name: a.name || 'attachment',
    content: a.content, // base64 string
  }));

  if (apiKey) {
    try {
      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipientEmail }],
        replyTo: replyTo ? { email: replyTo } : { email: senderEmail },
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent || undefined,
        tags: tags || ['auxosys-outreach'],
      };

      if (brevoAttachments.length > 0) {
        payload.attachment = brevoAttachments;
      }

      const response = await axios.post(
        `${BREVO_API_BASE}/smtp/email`,
        payload,
        {
          headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          timeout: 25000,
        }
      );
      return { messageId: response.data?.messageId || response.data?.messageIds?.[0] };
    } catch (apiErr) {
      console.warn('[BrevoService] API call failed, falling back to Brevo SMTP:', apiErr.response?.data || apiErr.message);
    }
  }

  // Fallback to Nodemailer Brevo SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp-brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });

  const nodemailerAttachments = (attachments || []).map(a => ({
    filename: a.name || 'attachment',
    content: Buffer.from(a.content, 'base64'),
    contentType: a.contentType || undefined,
  }));

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: recipientEmail,
    replyTo: replyTo || senderEmail,
    subject: subject,
    html: htmlContent,
    text: textContent,
    attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
  });

  return { messageId: info.messageId };
}

/**
 * Syncs company sender verification status from Brevo API (GET /v3/senders).
 */
async function fetchBrevoSenders() {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const res = await axios.get(`${BREVO_API_BASE}/senders`, {
      headers: { 'api-key': apiKey },
    });
    return res.data?.senders || [];
  } catch (err) {
    console.error('[BrevoService] Error fetching Brevo senders:', err.response?.data || err.message);
    return [];
  }
}

module.exports = {
  sendEmail,
  fetchBrevoSenders,
};
