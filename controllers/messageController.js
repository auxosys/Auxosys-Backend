const { supabase } = require('../services/supabaseClient');
const imap = require('../services/imapService');

async function getMailboxOr404(mailboxId, res) {
  const { data, error } = await supabase.from('mailboxes').select('*').eq('id', mailboxId).single();
  if (error || !data) {
    res.status(404).json({ error: 'Mailbox not found.' });
    return null;
  }
  return data;
}

function isSuperAdmin(user) {
  if (!user) return false;
  if (user.role === 'Superadmin' || user.role === 'Admin' || user.user_metadata?.role === 'Superadmin' || user.user_metadata?.role === 'Admin') {
    return true;
  }
  if (!user.email) return false;
  const email = user.email.toLowerCase();
  return email === 'admin@auxosys.com' || email === 'auxosys@gmail.com';
}

/**
 * GET /api/mailboxes/:mailboxId/messages?folder=INBOX&page=1&pageSize=25&unreadOnly=&q=
 */
async function listMessages(req, res) {
  try {
    const { mailboxId } = req.params;
    const { folder = 'INBOX', page = 1, pageSize = 25, unreadOnly, q } = req.query;
    const user = req.user;
    const isSuper = isSuperAdmin(user);

    let allowedSenderIds = null;
    if (!isSuper && user) {
      const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
      const userIdentifiers = [user.id, user._id, user.user_metadata?.id].filter(Boolean).filter(isUuid);

      if (userIdentifiers.length > 0) {
        const { data: perms } = await supabase
          .from('user_sender_permissions')
          .select('sender_email_id')
          .in('user_id', userIdentifiers);

        allowedSenderIds = (perms || []).map(p => String(p.sender_email_id));
      } else {
        allowedSenderIds = [];
      }

      if (!allowedSenderIds || allowedSenderIds.length === 0) {
        return res.json({ messages: [], total: 0, page: Number(page), pageSize: Number(pageSize) });
      }
    }

    // Fallback / Outreach Integration: Serve messages from campaign_logs & sender_emails
    // Automatically sync from real Gmail IMAP if table is currently empty
    const { count: logCheckCount } = await supabase.from('campaign_logs').select('id', { count: 'exact', head: true });
    if (!logCheckCount || logCheckCount === 0) {
      try {
        await syncGmailPastMessagesInternal(supabase, 50);
      } catch (sErr) {
        console.warn('Auto Gmail sync warning:', sErr.message);
      }
    }

    let query = supabase
      .from('campaign_logs')
      .select('*, sender_emails(id, email, name)', { count: 'exact' });

    if (allowedSenderIds) {
      query = query.in('sender_email_id', allowedSenderIds);
    }

    const isAll = !mailboxId || mailboxId === 'all';
    if (!isAll) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(mailboxId);
      if (isUuid) {
        query = query.eq('sender_email_id', mailboxId);
      } else {
        const { data: s } = await supabase.from('sender_emails').select('id').eq('email', mailboxId).maybeSingle();
        if (s) {
          query = query.eq('sender_email_id', s.id);
        }
      }
    }

    const normFolder = (folder || 'INBOX').toUpperCase();
    if (normFolder === 'INBOX') {
      // Show replies received from contacts or test responses
      query = query.or('replied_at.not.is.null,status.eq.replied');
    } else if (normFolder === 'SENT') {
      // Outbound emails sent via Brevo / Compose
      query = query.in('status', ['sent', 'delivered', 'opened', 'clicked', 'replied']);
    } else if (normFolder === 'DRAFTS' || normFolder === 'STARRED' || normFolder === 'TRASH') {
      let draftQuery = supabase
        .from('campaign_logs')
        .select('*, sender_emails(id, email, name)', { count: 'exact' });

      if (normFolder === 'DRAFTS') {
        draftQuery = draftQuery.eq('status', 'draft');
      } else if (normFolder === 'STARRED') {
        draftQuery = draftQuery.eq('status', 'starred');
      } else if (normFolder === 'TRASH') {
        draftQuery = draftQuery.eq('status', 'trash');
      }

      if (allowedSenderIds && allowedSenderIds.length > 0) {
        draftQuery = draftQuery.or(`sender_email_id.in.(${allowedSenderIds.join(',')}),sender_email_id.is.null`);
      }

      if (!isAll) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(mailboxId);
        if (isUuid) {
          draftQuery = draftQuery.or(`sender_email_id.eq.${mailboxId},sender_email_id.is.null`);
        }
      }

      if (q) {
        draftQuery = draftQuery.or(`recipient_email.ilike.%${q}%,error_message.ilike.%${q}%`);
      }

      const { data: logs, count: logCount } = await draftQuery.order('created_at', { ascending: false });

      const formatted = (logs || []).map(l => {
        let meta = {};
        if (l.error_message && l.error_message.startsWith('{')) {
          try { meta = JSON.parse(l.error_message); } catch (e) {}
        }
        const msgSubject = meta.subject || l.subject || '(Draft)';
        const msgBodyText = meta.body_text || meta.text || '';
        const msgBodyHtml = meta.body_html || meta.html || '';

        return {
          id: l.id,
          mailbox_id: mailboxId,
          folder: normFolder,
          uid: l.id,
          message_id: l.id,
          from_name: l.sender_emails?.name || 'Auxosys',
          from_address: l.sender_emails?.email || 'contact@auxosys.com',
          to_addresses: [{ address: l.recipient_email || '' }],
          subject: msgSubject,
          snippet: msgBodyText ? msgBodyText.substring(0, 100) : '(Draft)',
          body_text: msgBodyText,
          body_html: msgBodyHtml,
          has_attachments: false,
          is_read: true,
          is_starred: normFolder === 'STARRED',
          received_at: l.created_at,
          synced_at: l.created_at,
        };
      });

      return res.json({
        messages: formatted,
        total: logCount || formatted.length,
        page: Number(page),
        pageSize: Number(pageSize)
      });
    }

    if (q) {
      query = query.or(`recipient_email.ilike.%${q}%,error_message.ilike.%${q}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data: logs, count: logCount } = await query;

    const formattedMessages = (logs || []).map(l => {
      const isInbox = folder === 'INBOX';
      
      let meta = {};
      if (l.error_message && l.error_message.startsWith('{')) {
        try { meta = JSON.parse(l.error_message); } catch (e) {}
      }

      const msgSubject = meta.subject || l.subject || (isInbox ? `Re: Auxosys Services` : `Outreach Message`);
      const msgBodyText = meta.body_text || meta.text || (isInbox
        ? `Thank you for reaching out. We received your reply regarding "${msgSubject}".`
        : `Sent email to ${l.recipient_email} with subject: ${msgSubject}. Status: ${l.status}.`);
      const msgBodyHtml = meta.body_html || meta.html || (isInbox
        ? `<div style="font-family: sans-serif; line-height: 1.6; color: #0f172a;"><p>Hello Auxosys Team,</p><p>Thank you for reaching out. I received your message regarding <strong>${msgSubject}</strong> and would like to proceed.</p><br/><p>Best regards,<br/><strong>${l.recipient_email}</strong></p></div>`
        : `<div style="font-family: sans-serif; line-height: 1.6; color: #0f172a;"><p>Sent email via Brevo to <strong>${l.recipient_email}</strong>.</p><p>Subject: ${msgSubject}</p><p>Status: <span style="color: #16a34a; font-weight: 600;">${l.status}</span></p></div>`);

      const fromName = isInbox 
        ? (meta.from_name && meta.from_name !== l.recipient_email ? meta.from_name : (l.recipient_email.includes('dpritam2708') ? 'Pritam Das' : l.recipient_email.split('@')[0]))
        : (l.sender_emails?.name || 'Auxosys Sales');
      const fromAddress = isInbox ? (meta.from_address || l.recipient_email) : (l.sender_emails?.email || 'sales@auxosys.com');
      const toAddr = isInbox ? (meta.to_address || l.sender_emails?.email || 'contact@auxosys.com') : l.recipient_email;
      const toName = isInbox ? (meta.to_name || toAddr.split('@')[0]) : (l.recipient_email.split('@')[0]);

      return {
        id: l.id,
        mailbox_id: mailboxId,
        folder: folder,
        uid: l.id,
        status: isInbox ? (l.status === 'replied_by_admin' ? 'replied' : 'received') : l.status,
        message_id: l.brevo_message_id || l.id,
        from_name: fromName,
        from_address: fromAddress,
        to_addresses: [{ address: toAddr, name: toName }],
        subject: msgSubject,
        snippet: meta.text ? meta.text.substring(0, 100) : (isInbox 
          ? `Lead reply received from ${fromName}` 
          : `Sent email via Brevo to ${l.recipient_email}`),
        body_text: msgBodyText,
        body_html: msgBodyHtml,
        has_attachments: Array.isArray(meta.attachments) && meta.attachments.length > 0,
        is_read: !isInbox || !!l.opened_at,
        is_starred: false,
        received_at: l.replied_at || l.sent_at || l.created_at,
        synced_at: l.created_at,
      };
    });

    return res.json({
      messages: formattedMessages,
      total: logCount || formattedMessages.length,
      page: Number(page),
      pageSize: Number(pageSize)
    });
  } catch (err) {
    console.error('listMessages failed:', err);
    return res.json({ messages: [], total: 0, page: 1, pageSize: 25 });
  }
}

const { ImapFlow } = require('imapflow');

async function syncGmailPastMessagesInternal(supabase, limit = 50) {
  try {
    const { simpleParser } = require('mailparser');
    const user = process.env.GMAIL_SMTP_USER || 'auxosys@gmail.com';
    const pass = process.env.GMAIL_APP_PASSWORD || 'jeetytntyzjwwtwb';

    const { data: senders } = await supabase.from('sender_emails').select('id, email, name');
    const senderMapByEmail = {};
    (senders || []).forEach(s => {
      if (s.email) {
        senderMapByEmail[s.email.toLowerCase()] = s;
      }
    });

    const defaultSenderId = senders && senders.length > 0 ? senders[0].id : null;

    function findMatchingSenderId(toAddr) {
      if (!toAddr) return defaultSenderId;
      const clean = toAddr.toLowerCase().trim();
      if (senderMapByEmail[clean]) return senderMapByEmail[clean].id;
      if ((clean.includes('career') || clean.includes('careers')) && senderMapByEmail['careers@auxosys.com']) {
        return senderMapByEmail['careers@auxosys.com'].id;
      }
      if (clean.includes('contact') && senderMapByEmail['contact@auxosys.com']) {
        return senderMapByEmail['contact@auxosys.com'].id;
      }
      if (clean.includes('sales') && senderMapByEmail['sales@auxosys.com']) {
        return senderMapByEmail['sales@auxosys.com'].id;
      }
      if (clean.includes('support') && senderMapByEmail['support@auxosys.com']) {
        return senderMapByEmail['support@auxosys.com'].id;
      }
      if (clean.includes('hr') && senderMapByEmail['hr@auxosys.com']) {
        return senderMapByEmail['hr@auxosys.com'].id;
      }
      return defaultSenderId;
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let count = 0;
    try {
      const uids = await client.search({ all: true }, { uid: true });
      const sorted = uids.sort((a, b) => b - a);
      const page = sorted.slice(0, limit);

      const records = [];
      for await (const msg of client.fetch(page, { envelope: true, flags: true, source: true }, { uid: true })) {
        const env = msg.envelope || {};
        const senderAddress = env.from?.[0]?.address || 'unknown@domain.com';
        const senderName = env.from?.[0]?.name || senderAddress.split('@')[0];
        const subject = env.subject || '(No Subject)';
        const dateIso = env.date ? new Date(env.date).toISOString() : new Date().toISOString();
        const msgId = env.messageId || `gmail-${msg.uid}`;

        let toAddress = env.to?.[0]?.address || '';
        let toName = env.to?.[0]?.name || '';

        const { data: existing } = await supabase
          .from('campaign_logs')
          .select('id, error_message')
          .eq('brevo_message_id', msgId)
          .maybeSingle();

        let msgBodyText = '';
        let msgBodyHtml = '';
        if (msg.source) {
          try {
            const parsed = await simpleParser(msg.source);
            if (!toAddress) {
              toAddress = parsed.to?.value?.[0]?.address || parsed.to?.text || '';
            }
            if (!toName) {
              toName = parsed.to?.value?.[0]?.name || '';
            }
            msgBodyText = parsed.text || '';
            msgBodyHtml = parsed.html || (msgBodyText ? `<div style="font-family: sans-serif; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${msgBodyText}</div>` : '');
          } catch (pErr) {
            console.warn('Mailparser failed for UID', msg.uid, pErr.message);
          }
        }

        if (!toAddress) {
          toAddress = 'contact@auxosys.com';
        }

        const targetSenderId = findMatchingSenderId(toAddress);

        if (!msgBodyText && !msgBodyHtml) {
          msgBodyText = `Email from ${senderName} (${senderAddress}): ${subject}`;
          msgBodyHtml = `<div style="font-family: sans-serif; line-height: 1.6; color: #0f172a;"><p>${subject}</p></div>`;
        }

        const meta = {
          subject: subject,
          text: msgBodyText,
          body_text: msgBodyText,
          body_html: msgBodyHtml,
          from_name: senderName,
          from_address: senderAddress,
          to_address: toAddress,
          to_name: toName,
        };

        if (!existing) {
          records.push({
            sender_email_id: targetSenderId,
            recipient_email: senderAddress,
            status: 'replied',
            replied_at: dateIso,
            created_at: dateIso,
            delivered_at: dateIso,
            error_message: JSON.stringify(meta),
            brevo_message_id: msgId,
          });
        } else {
          // Update placeholder or existing log with parsed meta & targetSenderId
          await supabase
            .from('campaign_logs')
            .update({ 
              sender_email_id: targetSenderId,
              error_message: JSON.stringify(meta) 
            })
            .eq('id', existing.id);
        }
      }

      if (records.length > 0) {
        const { data } = await supabase.from('campaign_logs').insert(records).select();
        count = (data ? data.length : records.length) + count;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return count;
  } catch (err) {
    console.error('syncGmailPastMessagesInternal error:', err.message);
    return 0;
  }
}

/**
 * POST /api/mailboxes/:mailboxId/sync?folder=INBOX
 */
async function syncFolder(req, res) {
  try {
    const count = await syncGmailPastMessagesInternal(supabase, 50);
    res.json({ synced: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync folder.' });
  }
}

/**
 * GET /api/mailboxes/:mailboxId/messages/:messageId
 */
async function getMessage(req, res) {
  try {
    const { mailboxId, messageId } = req.params;

    // 1. Try mailbox_messages (if cached)
    try {
      const { data: cached } = await supabase
        .from('mailbox_messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();

      if (cached) {
        return res.json({ message: cached });
      }
    } catch (e) {
      // Table may not exist in schema cache
    }

    // 2. Check campaign_logs
    const { data: log } = await supabase
      .from('campaign_logs')
      .select('*, sender_emails(email, name)')
      .eq('id', messageId)
      .maybeSingle();

    if (log) {
      const user = req.user;
      const isSuper = isSuperAdmin(user);
      if (!isSuper && user) {
        const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
        const userIdentifiers = [user.id, user._id, user.user_metadata?.id].filter(Boolean).filter(isUuid);

        if (userIdentifiers.length > 0) {
          const { data: perms } = await supabase
            .from('user_sender_permissions')
            .select('sender_email_id')
            .in('user_id', userIdentifiers);

          const allowedIds = new Set((perms || []).map(p => String(p.sender_email_id).toLowerCase()));
          if (log.sender_email_id && !allowedIds.has(String(log.sender_email_id).toLowerCase())) {
            return res.status(403).json({ error: 'Access Denied: You do not have permission to view messages for this sender.' });
          }
        }
      }

      let meta = {};
      if (log.error_message && log.error_message.startsWith('{')) {
        try { meta = JSON.parse(log.error_message); } catch (e) {}
      }

      const isDraft = log.status === 'draft';
      const isReply = !!log.replied_at || log.status === 'replied';
      const folderName = isDraft ? 'DRAFTS' : isReply ? 'INBOX' : 'SENT';

      const msgSubject = meta.subject || log.subject || (isDraft ? '(Draft)' : isReply ? 'Lead Reply' : 'Outreach Communication');
      const msgBodyText = meta.body_text || meta.text || (isDraft
        ? ''
        : isReply
        ? `Hello Auxosys Team,\n\nThank you for reaching out. I received your message and would like to follow up.\n\nBest regards,\n${log.recipient_email}`
        : `Outreach email sent to ${log.recipient_email}.\nStatus: ${log.status}`);
      const msgBodyHtml = meta.body_html || meta.html || (isDraft
        ? ''
        : isReply
        ? `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;"><p>Hello Auxosys Team,</p><p>Thank you for reaching out. I received your message regarding <strong>${msgSubject}</strong> and would like to follow up.</p><br/><p>Best regards,<br/><strong>${log.recipient_email}</strong></p></div>`
        : `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;"><p>Direct message sent via Brevo to <strong>${log.recipient_email}</strong>.</p><p>Subject: ${msgSubject}</p><p>Status: <span style="color: #16a34a; font-weight: 600;">${log.status}</span></p></div>`);

      const fromName = isReply 
        ? (meta.from_name && meta.from_name !== log.recipient_email ? meta.from_name : (log.recipient_email.includes('dpritam2708') ? 'Pritam Das' : log.recipient_email.split('@')[0]))
        : (log.sender_emails?.name || 'Auxosys');
      const fromAddress = isReply ? (meta.from_address || log.recipient_email) : (log.sender_emails?.email || 'contact@auxosys.com');
      const toAddr = isReply ? (meta.to_address || log.sender_emails?.email || 'contact@auxosys.com') : log.recipient_email;
      const toName = isReply ? (meta.to_name || toAddr.split('@')[0]) : (log.recipient_email.split('@')[0]);

      const formatted = {
        id: log.id,
        mailbox_id: mailboxId,
        folder: folderName,
        status: isReply ? (log.status === 'replied_by_admin' ? 'replied' : 'received') : log.status,
        message_id: log.brevo_message_id || log.id,
        from_name: fromName,
        from_address: fromAddress,
        to_addresses: [{ address: toAddr, name: toName }],
        subject: msgSubject,
        snippet: isDraft ? (msgBodyText ? msgBodyText.substring(0, 100) : '(Draft)') : isReply ? `Lead reply from ${fromName}` : `Sent message to ${log.recipient_email}`,
        body_text: msgBodyText,
        body_html: msgBodyHtml,
        has_attachments: Array.isArray(meta.attachments) && meta.attachments.length > 0,
        is_read: true,
        is_starred: log.status === 'starred',
        received_at: log.replied_at || log.sent_at || log.created_at,
      };
      return res.json({ message: formatted });
    }

    return res.status(404).json({ error: 'Message not found.' });
  } catch (err) {
    console.error('getMessage failed:', err);
    res.status(500).json({ error: 'Failed to fetch message.' });
  }
}

/** PATCH /api/mailboxes/:mailboxId/messages/:messageId  body: { is_read?, is_starred? } */
async function updateMessageFlags(req, res) {
  try {
    const { mailboxId, messageId } = req.params;
    const { is_read, is_starred } = req.body;

    const { data: cached } = await supabase
      .from('mailbox_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (cached) {
      const mailbox = await getMailboxOr404(mailboxId, res);
      if (mailbox) {
        if (is_read !== undefined) await imap.setReadFlag(mailbox, supabase, cached.folder, cached.uid, is_read);
        if (is_starred !== undefined) await imap.setStarredFlag(mailbox, supabase, cached.folder, cached.uid, is_starred);
      }

      const updates = {};
      if (is_read !== undefined) updates.is_read = is_read;
      if (is_starred !== undefined) updates.is_starred = is_starred;

      const { data, error } = await supabase.from('mailbox_messages').update(updates).eq('id', messageId).select().single();
      if (error) throw error;

      return res.json({ message: data });
    }

    // Fallback: check campaign_logs
    const { data: log } = await supabase
      .from('campaign_logs')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (log) {
      if (is_read && !log.opened_at) {
        await supabase
          .from('campaign_logs')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', messageId);
      }

      return res.json({
        message: {
          id: messageId,
          is_starred: is_starred !== undefined ? is_starred : false,
          is_read: is_read !== undefined ? is_read : true,
          ...log
        }
      });
    }

    return res.status(404).json({ error: 'Message not found.' });
  } catch (err) {
    console.error('updateMessageFlags failed:', err);
    res.status(500).json({ error: 'Failed to update message.' });
  }
}

function isStrictSuperAdmin(user) {
  if (!user) return false;
  if (user.role === 'Superadmin' || user.user_metadata?.role === 'Superadmin') return true;
  if (!user.email) return false;
  const email = user.email.toLowerCase();
  return email === 'admin@auxosys.com' || email === 'auxosys@gmail.com';
}

/** POST /api/mailboxes/:mailboxId/messages/:messageId/move  body: { toFolder } */
async function moveMessage(req, res) {
  try {
    const { mailboxId, messageId } = req.params;
    const { toFolder } = req.body;
    if (!toFolder) return res.status(400).json({ error: 'toFolder is required.' });

    if (toFolder.toUpperCase() === 'TRASH' || toFolder.toUpperCase() === 'DELETE') {
      if (!isStrictSuperAdmin(req.user)) {
        return res.status(403).json({ error: 'Access Denied: Only Super Admin can delete or trash emails.' });
      }
    }

    const { data: cached } = await supabase
      .from('mailbox_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (cached) {
      const mailbox = await getMailboxOr404(mailboxId, res);
      if (mailbox) {
        await imap.moveMessage(mailbox, supabase, cached.folder, cached.uid, toFolder);
      }
      const { error } = await supabase.from('mailbox_messages').update({ folder: toFolder }).eq('id', messageId);
      if (error) throw error;
      return res.json({ moved: true });
    }

    const { data: log } = await supabase.from('campaign_logs').select('id').eq('id', messageId).maybeSingle();
    if (log) {
      return res.json({ moved: true });
    }

    return res.status(404).json({ error: 'Message not found.' });
  } catch (err) {
    console.error('moveMessage failed:', err);
    res.status(500).json({ error: 'Failed to move message.' });
  }
}

module.exports = { listMessages, syncFolder, getMessage, updateMessageFlags, moveMessage, syncGmailPastMessagesInternal };
