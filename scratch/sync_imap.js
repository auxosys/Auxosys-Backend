const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { supabase } = require('../services/supabaseClient');

async function syncNow() {
  const user = process.env.GMAIL_SMTP_USER || 'auxosys@gmail.com';
  const pass = process.env.GMAIL_APP_PASSWORD || 'jeetytntyzjwwtwb';

  console.log('Connecting to Gmail IMAP for', user);

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
  try {
    const uids = await client.search({ all: true }, { uid: true });
    const sorted = uids.sort((a, b) => b - a);
    console.log('Total UIDs found in INBOX:', sorted.length);

    for await (const msg of client.fetch(sorted.slice(0, 50), { envelope: true, source: true }, { uid: true })) {
      const env = msg.envelope || {};
      const msgId = env.messageId || `gmail-${msg.uid}`;
      const subject = env.subject || '(No Subject)';
      const senderAddress = env.from?.[0]?.address || 'unknown@domain.com';
      const senderName = env.from?.[0]?.name || senderAddress.split('@')[0];

      let toAddress = env.to?.[0]?.address || '';
      let toName = env.to?.[0]?.name || '';

      let parsed = {};
      if (msg.source) {
        try {
          parsed = await simpleParser(msg.source);
          if (!toAddress) {
            toAddress = parsed.to?.value?.[0]?.address || parsed.to?.text || '';
          }
          if (!toName) {
            toName = parsed.to?.value?.[0]?.name || '';
          }
        } catch (pe) {
          console.error('Mailparser error for UID', msg.uid, pe);
        }
      }

      if (!toAddress) {
        toAddress = 'contact@auxosys.com';
      }

      const targetSenderId = findMatchingSenderId(toAddress);

      const msgBodyText = (parsed.text || '').trim();
      const msgBodyHtml = parsed.html || (msgBodyText ? `<div style="font-family: sans-serif; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${msgBodyText}</div>` : '');

      console.log(`\n--- UID ${msg.uid} | Subject: "${subject}" | To: ${toAddress} ---`);

      if (msgBodyText || msgBodyHtml) {
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

        const { data: existing } = await supabase
          .from('campaign_logs')
          .select('id, error_message')
          .eq('brevo_message_id', msgId)
          .maybeSingle();

        if (existing) {
          console.log(`Updating existing log [ID: ${existing.id}] for MsgId: ${msgId} (SenderID: ${targetSenderId})`);
          const { error: updErr } = await supabase
            .from('campaign_logs')
            .update({ 
              sender_email_id: targetSenderId,
              error_message: JSON.stringify(meta) 
            })
            .eq('id', existing.id);
          if (updErr) console.error('Update error:', updErr);
        } else {
          console.log(`Inserting new log for MsgId: ${msgId} (SenderID: ${targetSenderId})`);
          const dateIso = env.date ? new Date(env.date).toISOString() : new Date().toISOString();
          await supabase.from('campaign_logs').insert({
            sender_email_id: targetSenderId,
            recipient_email: senderAddress,
            status: 'replied',
            replied_at: dateIso,
            created_at: dateIso,
            delivered_at: dateIso,
            error_message: JSON.stringify(meta),
            brevo_message_id: msgId,
          });
        }
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

syncNow().catch(err => console.error('Err:', err));
