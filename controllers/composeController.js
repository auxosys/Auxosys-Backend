const { supabase } = require('../services/supabaseClient');
const { sendMail } = require('../services/smtpService');
const { appendDraft } = require('../services/imapService');

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

async function saveDraft(req, res) {
  try {
    const { draftId, senderEmailId, senderEmail, to, subject, html, text, body } = req.body;
    const recipientEmail = Array.isArray(to) ? to.join(',') : (to || '');
    const user = req.user;

    // Resolve a valid sender_email_id if not explicitly provided
    let senderIdToUse = senderEmailId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(senderEmailId)
      ? senderEmailId
      : null;

    if (!senderIdToUse) {
      const { data: defaultSender } = await supabase.from('sender_emails').select('id').eq('status', 'active').limit(1).maybeSingle();
      if (defaultSender) senderIdToUse = defaultSender.id;
    }

    const meta = {
      subject: subject || '(Draft)',
      html: html || '',
      text: text || body || '',
      body_text: text || body || '',
      body_html: html || ''
    };

    const draftRecord = {
      sender_email_id: senderIdToUse,
      created_by_user_id: user?.id || null,
      recipient_email: recipientEmail || 'draft@auxosys.com',
      status: 'draft',
      error_message: JSON.stringify(meta),
      created_at: new Date().toISOString()
    };

    const targetId = draftId || req.params?.id;
    if (targetId) {
      const { data, error } = await supabase
        .from('campaign_logs')
        .update(draftRecord)
        .eq('id', targetId)
        .select()
        .single();

      if (!error && data) return res.json({ success: true, draft: data });
    }

    const { data, error } = await supabase.from('campaign_logs').insert([draftRecord]).select().single();

    if (error) {
      console.error('Supabase insert into campaign_logs error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to save draft in database.' });
    }

    // Async sync draft to Gmail IMAP [Gmail]/Drafts folder
    (async () => {
      try {
        const { data: mb } = await supabase.from('mailboxes').select('*').limit(1).maybeSingle();
        if (mb) {
          await appendDraft(mb, supabase, { to: recipientEmail, subject: subject || '(Draft)', html: html || '', text: text || body || '' });
        }
      } catch (e) {
        console.warn('[GmailDraftSync] Background sync warn:', e.message);
      }
    })();

    res.status(201).json({ success: true, draft: data });
  } catch (err) {
    console.error('saveDraft failed:', err);
    res.status(500).json({ error: err.message || 'Failed to save draft.' });
  }
}

function isStrictSuperAdmin(user) {
  if (!user) return false;
  if (user.role === 'Superadmin' || user.user_metadata?.role === 'Superadmin') return true;
  if (!user.email) return false;
  const email = user.email.toLowerCase();
  return email === 'admin@auxosys.com' || email === 'auxosys@gmail.com';
}

async function deleteDraft(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Draft ID is required.' });

    if (!isStrictSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Access Denied: Only Super Admin can delete emails and drafts.' });
    }

    const { error } = await supabase.from('campaign_logs').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('deleteDraft failed:', err);
    res.status(500).json({ error: err.message || 'Failed to delete draft.' });
  }
}

module.exports = { send, saveDraft, deleteDraft };
