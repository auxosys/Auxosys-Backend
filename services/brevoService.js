/**
 * brevoService.js
 *
 * Centralized Brevo Email Infrastructure Service.
 * Handles API & SMTP delivery via Brevo, sender status verification sync,
 * and webhook event processing for real-time delivery tracking.
 */

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const axios = require('axios');
const nodemailer = require('nodemailer');


const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey() {
  return process.env.BREVO_API_KEY;
}

function prepareEmailHtml(rawHtml, rawText) {
  if (!rawHtml || !rawHtml.trim()) {
    if (!rawText || !rawText.trim()) return '<p></p>';
    const escaped = String(rawText)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
    rawHtml = `<div>${escaped}</div>`;
  }

  // Clean redundant trailing <br> tags inside <p> blocks
  rawHtml = rawHtml.replace(/(?:<br\s*\/?>\s*)+<\/p>/gi, '</p>');

  // If already wrapped in a complete HTML document, preserve it
  if (/<html[\s>]/i.test(rawHtml) || /<!DOCTYPE/i.test(rawHtml)) {
    return rawHtml;
  }


  // Ensure highlight styling has inline padding and rounded edges for high-fidelity rendering across all email clients
  const enhancedHtml = rawHtml.replace(/style="([^"]*background-color:[^"]*)"/gi, (match, styleContent) => {
    let newStyle = styleContent;
    if (!/padding\s*:/i.test(newStyle)) {
      newStyle += '; padding: 1px 4px;';
    }
    if (!/border-radius\s*:/i.test(newStyle)) {
      newStyle += '; border-radius: 3px;';
    }
    return `style="${newStyle}"`;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #1e293b; background-color: #ffffff;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #1e293b;">
    ${enhancedHtml}
  </div>
</body>
</html>`;
}

const { appendSentToGmailIMAP } = require('./imapService');

/**
 * Sends a transactional or outreach email via Gmail Direct SMTP (0 Brevo limit used) or Brevo API / SMTP.
 */
async function sendEmail({ senderName, senderEmail, recipientEmail, subject, htmlContent, textContent, replyTo, tags, attachments, provider, smtpUser, smtpPass }) {
  const finalHtml = prepareEmailHtml(htmlContent, textContent);
  const targetProvider = (provider || '').toLowerCase();
  const gmailPass = smtpPass || process.env.GMAIL_APP_PASSWORD;
  const gmailUser = smtpUser || process.env.GMAIL_SMTP_USER || 'auxosys@gmail.com';
  const isAuxosysDomain = senderEmail && senderEmail.toLowerCase().endsWith('@auxosys.com');
  const isBrevoExplicit = targetProvider === 'brevo' || isAuxosysDomain || (Array.isArray(tags) && tags.some(t => t.includes('brevo') || t.includes('campaign') || t.includes('automated')));

  let result = null;

  // 1. Send via Direct Gmail SMTP (0 Brevo Limit Used) ONLY for @gmail.com or explicit gmail requests
  if ((targetProvider === 'gmail' || (gmailPass && !isBrevoExplicit)) && targetProvider !== 'brevo' && !isAuxosysDomain) {
    try {
      const gmailTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
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
        html: finalHtml,
        text: textContent,
        attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
      });

      result = { messageId: info.messageId, provider: 'gmail' };
    } catch (gmailErr) {
      console.warn('[GmailSMTP] Direct Gmail SMTP failed, attempting Brevo fallback:', gmailErr.message);
    }
  }

  if (!result) {
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
          htmlContent: finalHtml,
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
        result = { messageId: response.data?.messageId || response.data?.messageIds?.[0], provider: 'brevo' };
      } catch (apiErr) {
        console.warn('[BrevoService] API call failed, falling back to Brevo SMTP:', apiErr.response?.data || apiErr.message);
      }
    }
  }

  if (!result) {
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
      filename: a.name || a.filename || 'attachment',
      content: typeof a.content === 'string' ? Buffer.from(a.content, 'base64') : a.content,
      contentType: a.contentType || undefined,
    }));

    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipientEmail,
      replyTo: replyTo || senderEmail,
      subject: subject,
      html: finalHtml,
      text: textContent,
      attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
    });

    result = { messageId: info.messageId, provider: 'brevo-smtp' };
  }

  // Non-blocking IMAP append to real Gmail's [Gmail]/Sent Mail so sent mail appears in real Gmail in:sent
  if (result) {
    appendSentToGmailIMAP({
      senderName,
      senderEmail,
      recipientEmail,
      subject,
      htmlContent: finalHtml,
      textContent,
      attachments,
    }).catch(e => console.warn('[GmailIMAP] Non-critical Sent append warning:', e.message));
  }

  return result;
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
