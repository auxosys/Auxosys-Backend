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
 * Sends a transactional or outreach email via Gmail Direct SMTP (0 Brevo limit used) or Brevo API / SMTP.
 */
async function sendEmail({ senderName, senderEmail, recipientEmail, subject, htmlContent, textContent, replyTo, tags, attachments, provider, smtpUser, smtpPass }) {
  const targetProvider = (provider || '').toLowerCase();
  const gmailPass = smtpPass || process.env.GMAIL_APP_PASSWORD;
  const gmailUser = smtpUser || process.env.GMAIL_SMTP_USER || 'auxosys@gmail.com';
  const isBrevoExplicit = targetProvider === 'brevo' || (Array.isArray(tags) && tags.some(t => t.includes('brevo') || t.includes('campaign') || t.includes('automated')));

  // 1. Send via Direct Gmail SMTP (0 Brevo Limit Used) for direct emails
  if ((targetProvider === 'gmail' || (gmailPass && !isBrevoExplicit)) && targetProvider !== 'brevo') {
    try {
      const gmailTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const nodemailerAttachments = (attachments || []).map(a => ({
        filename: a.name || a.filename || 'attachment',
        content: typeof a.content === 'string' ? Buffer.from(a.content, 'base64') : a.content,
        contentType: a.contentType || undefined,
      }));

      const info = await gmailTransporter.sendMail({
        from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
        to: recipientEmail,
        replyTo: replyTo || senderEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
        attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
      });

      return { messageId: info.messageId, provider: 'gmail' };
    } catch (gmailErr) {
      console.warn('[GmailSMTP] Direct Gmail SMTP failed, attempting Brevo fallback:', gmailErr.message);
    }
  }

  // 2. Send via Brevo API
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
      return { messageId: response.data?.messageId || response.data?.messageIds?.[0], provider: 'brevo' };
    } catch (apiErr) {
      console.warn('[BrevoService] API call failed, falling back to Brevo SMTP:', apiErr.response?.data || apiErr.message);
    }
  }

  // 3. Fallback to Nodemailer Brevo SMTP
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
    content: typeof a.content === 'string' ? Buffer.from(a.content, 'base64') : a.content,
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

  return { messageId: info.messageId, provider: 'brevo-smtp' };
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
