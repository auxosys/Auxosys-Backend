/**
 * webhookRoutes.js
 *
 * Express route for secure Brevo Webhooks.
 * Receives real-time delivery, open, click, bounce, unsubscribe, and inbound reply events.
 */

const express = require('express');
const supabase = require('../config/supabaseClient');

function makeWebhookRouter() {
  const router = express.Router();

  // Secure Webhook Endpoint: POST /api/webhooks/brevo
  router.post('/brevo', async (req, res) => {
    // Optional webhook secret check
    const secret = req.headers['x-brevo-secret'] || req.query.secret;
    if (process.env.BREVO_WEBHOOK_SECRET && secret !== process.env.BREVO_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    const payload = req.body;
    if (!payload || !payload.event) {
      return res.status(200).json({ received: true });
    }

    const { event, email, 'message-id': messageId, reason } = payload;
    const nowIso = new Date().toISOString();

    try {
      console.log(`[BrevoWebhook] Received event "${event}" for recipient: ${email}, messageId: ${messageId}`);

      // Lookup campaign log by message-id or recipient email
      let log = null;
      if (messageId) {
        const { data } = await supabase.from('campaign_logs').select('*').eq('brevo_message_id', messageId).single();
        log = data;
      }
      if (!log && email) {
        const { data } = await supabase.from('campaign_logs').select('*').eq('recipient_email', email).order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) log = data[0];
      }

      if (log) {
        if (event === 'delivered') {
          await supabase.from('campaign_logs').update({ status: 'delivered', delivered_at: nowIso }).eq('id', log.id);
        } else if (event === 'opened') {
          const updates = { open_count: (log.open_count || 0) + 1, updated_at: nowIso };
          if (!log.opened_at) updates.opened_at = nowIso;
          await supabase.from('campaign_logs').update(updates).eq('id', log.id);
        } else if (event === 'click') {
          const updates = { click_count: (log.click_count || 0) + 1, updated_at: nowIso };
          if (!log.clicked_at) updates.clicked_at = nowIso;
          if (!log.opened_at) updates.opened_at = nowIso;
          await supabase.from('campaign_logs').update(updates).eq('id', log.id);
        } else if (['hard_bounce', 'soft_bounce', 'blocked', 'spam'].includes(event)) {
          await supabase.from('campaign_logs').update({ status: 'bounced', error_message: reason || event }).eq('id', log.id);
          // Add to suppression list
          await supabase.from('contact_suppressions').upsert({ email, reason: event === 'spam' ? 'spam_complaint' : 'hard_bounce' }, { onConflict: 'email' });
          await supabase.from('contacts').update({ status: 'bounced' }).eq('email', email);
        } else if (event === 'unsubscribe') {
          await supabase.from('campaign_logs').update({ status: 'unsubscribed' }).eq('id', log.id);
          await supabase.from('contact_suppressions').upsert({ email, reason: 'unsubscribed' }, { onConflict: 'email' });
          await supabase.from('contacts').update({ status: 'unsubscribed' }).eq('email', email);
        } else if (['reply', 'inbound_email', 'inbound_reply'].includes(event)) {
          await supabase.from('campaign_logs').update({ replied_at: nowIso }).eq('id', log.id);
        }
      } else {
        // Unsubscribe or Bounce without specific campaign log
        if (['unsubscribe', 'hard_bounce', 'spam'].includes(event) && email) {
          await supabase.from('contact_suppressions').upsert({ email, reason: event === 'unsubscribe' ? 'unsubscribed' : 'hard_bounce' }, { onConflict: 'email' });
          await supabase.from('contacts').update({ status: event === 'unsubscribe' ? 'unsubscribed' : 'bounced' }).eq('email', email);
        }
      }
    } catch (err) {
      console.error('[BrevoWebhook] Error handling webhook event:', err.message);
    }

    return res.status(200).json({ received: true });
  });

  // Inbound Email Webhook: POST /api/webhooks/brevo/inbound
  router.post('/brevo/inbound', async (req, res) => {
    try {
      const payload = req.body;
      const senderEmail = payload.items?.[0]?.From?.Address || payload.sender?.email || payload.From;

      if (senderEmail) {
        console.log(`[BrevoInboundWebhook] Lead reply received from: ${senderEmail}`);
        const nowIso = new Date().toISOString();
        const { data: logs } = await supabase.from('campaign_logs').select('id, replied_at').eq('recipient_email', senderEmail).eq('status', 'sent');

        if (logs && logs.length > 0) {
          for (const l of logs) {
            if (!l.replied_at) {
              await supabase.from('campaign_logs').update({ replied_at: nowIso }).eq('id', l.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('[BrevoInboundWebhook] Error processing inbound reply:', err.message);
    }

    return res.status(200).json({ received: true });
  });

  return router;
}

module.exports = makeWebhookRouter;
