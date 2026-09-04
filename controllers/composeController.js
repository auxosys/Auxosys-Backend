const { supabase } = require('../services/supabaseClient');
const { sendMail } = require('../services/smtpService');

async function getMailboxOr404(mailboxId, res) {
  const { data, error } = await supabase.from('mailboxes').select('*').eq('id', mailboxId).single();
  if (error || !data) {
    res.status(404).json({ error: 'Mailbox not found.' });
    return null;
  }
  return data;
}

/**
 * POST /api/mailboxes/:mailboxId/send
 * multipart/form-data or JSON body:
 *   to, cc?, bcc?, subject, html, text?,
 *   inReplyToMessageId? (our internal mailbox_messages.id, for reply/forward threading)
 * Files attached under field name "attachments" (multiple allowed).
 */
async function send(req, res) {
  try {
    const { mailboxId } = req.params;
    const { to, cc, bcc, subject, html, text, inReplyToMessageId } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'to, subject, and html are required.' });
    }

    const mailbox = await getMailboxOr404(mailboxId, res);
    if (!mailbox) return;

    let inReplyTo, references;
    if (inReplyToMessageId) {
      const { data: original } = await supabase
        .from('mailbox_messages')
        .select('message_id')
        .eq('id', inReplyToMessageId)
        .single();
      if (original?.message_id) {
        inReplyTo = original.message_id;
        references = original.message_id;
      }
    }

    const attachments = (req.files || []).map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    }));

    const info = await sendMail(mailbox, supabase, {
      to, cc, bcc, subject, html, text, inReplyTo, references, attachments,
    });

    // Optimistically cache a copy into the Sent folder view so it shows
    // up immediately without waiting for the next IMAP sync of Sent.
    await supabase.from('mailbox_messages').upsert({
      mailbox_id: mailboxId,
      folder: 'SENT',
      uid: -Date.now(), // negative placeholder UID until the real IMAP sync reconciles it
      message_id: info.messageId,
      from_address: mailbox.email_address,
      from_name: mailbox.display_name || null,
      to_addresses: to.split(',').map((addr) => ({ address: addr.trim() })),
      cc_addresses: cc ? cc.split(',').map((addr) => ({ address: addr.trim() })) : [],
      subject,
      body_html: html,
      body_text: text || null,
      is_read: true,
      received_at: new Date().toISOString(),
    }, { onConflict: 'mailbox_id,folder,uid' });

    res.status(201).json({ sent: true, messageId: info.messageId });
  } catch (err) {
    console.error('send failed:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
}

module.exports = { send };
