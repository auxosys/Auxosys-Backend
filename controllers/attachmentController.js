const { supabase, uploadToStorage } = require('../services/supabaseClient');
const { openConnection } = require('../services/imapService');

/** GET /api/mailboxes/:mailboxId/messages/:messageId/attachments/:attachmentId */
async function downloadAttachment(req, res) {
  try {
    const { mailboxId, messageId, attachmentId } = req.params;

    const { data: attachment, error: attErr } = await supabase
      .from('mailbox_attachments').select('*').eq('id', attachmentId).eq('message_id', messageId).single();
    if (attErr || !attachment) return res.status(404).json({ error: 'Attachment not found.' });

    if (attachment.storage_path) {
      const { data } = supabase.storage.from('mailbox-attachments').getPublicUrl(attachment.storage_path);
      return res.redirect(data.publicUrl);
    }

    // Not cached yet — fetch from IMAP, store, then redirect.
    const { data: message } = await supabase.from('mailbox_messages').select('*').eq('id', messageId).single();
    const { data: mailbox } = await supabase.from('mailboxes').select('*').eq('id', mailboxId).single();
    if (!message || !mailbox) return res.status(404).json({ error: 'Message or mailbox not found.' });

    const client = await openConnection(mailbox, supabase);
    try {
      const lock = await client.getMailboxLock(message.folder);
      try {
        const { simpleParser } = require('mailparser');
        const full = await client.fetchOne(message.uid, { source: true }, { uid: true });
        const parsed = await simpleParser(full.source);
        const match = parsed.attachments.find((a) => a.filename === attachment.filename);
        if (!match) return res.status(404).json({ error: 'Attachment content not found on server.' });

        const path = `${mailboxId}/${messageId}/${attachmentId}-${attachment.filename}`;
        await uploadToStorage(path, match.content, attachment.content_type, 'mailbox-attachments');

        await supabase.from('mailbox_attachments').update({ storage_path: path }).eq('id', attachmentId);

        const { data: urlData } = supabase.storage.from('mailbox-attachments').getPublicUrl(path);
        res.redirect(urlData.publicUrl);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (err) {
    console.error('downloadAttachment failed:', err);
    res.status(500).json({ error: 'Failed to download attachment.' });
  }
}

module.exports = { downloadAttachment };
