/**
 * smtpService.js
 *
 * Sends mail via nodemailer, reusing the same mailbox row (and its
 * OAuth2 or app-password credentials) that IMAP uses to read mail —
 * one connected mailbox, both directions.
 */

const nodemailer = require('nodemailer');
const { decrypt } = require('./encryption');
const { getFreshAccessToken } = require('./googleOAuthService');

async function buildTransport(mailboxRow, supabase) {
  if (mailboxRow.auth_type === 'oauth2') {
    const accessToken = await getFreshAccessToken(mailboxRow, supabase);
    return nodemailer.createTransport({
      host: mailboxRow.smtp_host,
      port: mailboxRow.smtp_port,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: mailboxRow.email_address,
        accessToken,
      },
    });
  }

  return nodemailer.createTransport({
    host: mailboxRow.smtp_host,
    port: mailboxRow.smtp_port,
    secure: true,
    auth: {
      user: mailboxRow.email_address,
      pass: decrypt(mailboxRow.app_password),
    },
  });
}

/**
 * @param {Object} mailboxRow
 * @param {Object} supabase
 * @param {Object} message
 * @param {string} message.to            comma-separated recipients
 * @param {string} [message.cc]
 * @param {string} [message.bcc]
 * @param {string} message.subject
 * @param {string} message.html
 * @param {string} [message.text]
 * @param {string} [message.inReplyTo]    Message-ID header, for threading a reply
 * @param {string} [message.references]
 * @param {Array}  [message.attachments]  [{ filename, content: Buffer, contentType }]
 */
async function sendMail(mailboxRow, supabase, message) {
  const transport = await buildTransport(mailboxRow, supabase);

  const info = await transport.sendMail({
    from: mailboxRow.display_name
      ? `"${mailboxRow.display_name}" <${mailboxRow.email_address}>`
      : mailboxRow.email_address,
    to: message.to,
    cc: message.cc || undefined,
    bcc: message.bcc || undefined,
    subject: message.subject,
    html: message.html,
    text: message.text || undefined,
    inReplyTo: message.inReplyTo || undefined,
    references: message.references || undefined,
    attachments: message.attachments || undefined,
  });

  return info; // { messageId, ... }
}

module.exports = { sendMail };
