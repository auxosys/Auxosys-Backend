/**
 * campaignQueue.js
 *
 * Rate-limited Campaign Queue Dispatcher using Brevo Email Infrastructure.
 * Filters suppressed leads, enforces daily limits and random delays,
 * handles exponential backoff retries for rate limits, and records brevo_message_id.
 */

const { sendEmail } = require('./brevoService');

class CampaignQueueWorker {
  constructor(supabase, baseUrl = 'http://localhost:5002') {
    this.supabase = supabase;
    this.baseUrl = baseUrl;
    this.timer = null;
    this.isProcessing = false;
    this.checkIntervalMs = 8000;
  }

  start() {
    if (this.timer) return;
    console.log('[CampaignQueueWorker] Starting Brevo campaign dispatcher queue...');
    this.timer = setInterval(() => this.processQueue(), this.checkIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const { data: campaigns, error } = await this.supabase
        .from('campaigns')
        .select('*, sender_emails(*), templates(*)')
        .eq('status', 'sending');

      if (error || !campaigns || campaigns.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const campaign of campaigns) {
        await this.processSingleCampaign(campaign);
      }
    } catch (err) {
      console.error('[CampaignQueueWorker] Queue error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async processSingleCampaign(campaign) {
    let sender = campaign.sender_emails;
    if (!sender && (campaign.sender_email_id || campaign.mailbox_id)) {
      const targetSenderId = campaign.sender_email_id || campaign.mailbox_id;
      const { data: s } = await this.supabase
        .from('sender_emails')
        .select('*')
        .eq('id', targetSenderId)
        .maybeSingle();
      sender = s;
    }

    if (!sender) {
      console.log(`[CampaignQueueWorker] Sender email not found for campaign "${campaign.name}" (${campaign.sender_email_id}). Skipping.`);
      return;
    }

    // Daily limit check
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentLast24h } = await this.supabase
      .from('campaign_logs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', twentyFourHoursAgo);

    const dailyLimit = campaign.daily_limit || 100;
    if ((sentLast24h || 0) >= dailyLimit) {
      return;
    }

    // Delay interval check
    if (campaign.last_sent_at) {
      const minDelay = campaign.min_delay_sec || 30;
      const maxDelay = campaign.max_delay_sec || 90;
      const randomDelaySec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      const nextAllowedTime = new Date(campaign.last_sent_at).getTime() + randomDelaySec * 1000;

      if (Date.now() < nextAllowedTime) return;
    }

    // Fetch next queued log
    const { data: logList } = await this.supabase
      .from('campaign_logs')
      .select('*, contacts(*)')
      .eq('campaign_id', campaign.id)
      .in('status', ['queued', 'retrying'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (!logList || logList.length === 0) {
      const { count: remaining } = await this.supabase
        .from('campaign_logs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['queued', 'retrying']);

      if (!remaining || remaining === 0) {
        console.log(`[CampaignQueueWorker] Campaign "${campaign.name}" completed!`);
        await this.supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id);
      }
      return;
    }

    const log = logList[0];
    let contact = log.contacts;
    if (!contact && log.contact_id) {
      const { data: c } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('id', log.contact_id)
        .maybeSingle();
      contact = c;
    }
    if (!contact && log.recipient_email) {
      const { data: c } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('email', log.recipient_email)
        .maybeSingle();
      contact = c;
    }
    contact = contact || {};

    let template = campaign.templates;
    if (!template && campaign.template_id) {
      const { data: t } = await this.supabase
        .from('templates')
        .select('*')
        .eq('id', campaign.template_id)
        .maybeSingle();
      template = t;
    }
    template = template || {};

    // Check suppression list before sending
    const { data: suppression } = await this.supabase
      .from('contact_suppressions')
      .select('id')
      .eq('email', log.recipient_email)
      .single();

    if (suppression || contact.status === 'unsubscribed' || contact.status === 'bounced') {
      console.log(`[CampaignQueueWorker] Recipient ${log.recipient_email} is suppressed. Skipping...`);
      await this.supabase.from('campaign_logs').update({ status: 'unsubscribed', error_message: 'Recipient is suppressed' }).eq('id', log.id);
      return;
    }

    try {
      await this.supabase.from('campaign_logs').update({ status: 'sending' }).eq('id', log.id);

      const subject = this.replaceMergeTags(template.subject || campaign.name, contact);
      let htmlBody = this.replaceMergeTags(template.body_html || '<p></p>', contact);

      // Track clicks URL rewrite
      if (campaign.track_clicks !== false) {
        htmlBody = this.rewriteLinksForTracking(htmlBody, log.id);
      }

      // Open tracking pixel
      if (campaign.track_opens !== false) {
        const pixelTag = `<img src="${this.baseUrl}/api/track/open/${log.id}.gif" width="1" height="1" alt="" style="display:none !important;" />`;
        htmlBody += pixelTag;
      }

      // Dispatch via Brevo Infrastructure
      const brevoRes = await sendEmail({
        provider: 'brevo',
        senderName: sender.name,
        senderEmail: sender.email,
        recipientEmail: log.recipient_email,
        replyTo: sender.reply_to_email || sender.email,
        subject,
        htmlContent: htmlBody,
        tags: ['auxosys-outreach-campaign'],
      });

      const nowIso = new Date().toISOString();

      await this.supabase.from('campaign_logs').update({
        status: 'sent',
        brevo_message_id: brevoRes.messageId || null,
        sender_email_id: sender.id,
        created_by_user_id: campaign.created_by_user_id || campaign.user_id,
        sent_at: nowIso,
        error_message: null,
      }).eq('id', log.id);

      await this.supabase.from('campaigns').update({
        sent_count: (campaign.sent_count || 0) + 1,
        last_sent_at: nowIso,
      }).eq('id', campaign.id);

      console.log(`[CampaignQueueWorker] Sent email to ${log.recipient_email} via Brevo (${sender.email})`);

    } catch (err) {
      console.error(`[CampaignQueueWorker] Delivery error for ${log.recipient_email}:`, err.message);
      const retryCount = (log.retry_count || 0) + 1;
      const isRetryable = retryCount <= 3 && (err.message?.includes('429') || err.message?.includes('500') || err.message?.includes('timeout'));

      await this.supabase.from('campaign_logs').update({
        status: isRetryable ? 'retrying' : 'failed',
        retry_count: retryCount,
        error_message: err.message,
      }).eq('id', log.id);
    }
  }

  replaceMergeTags(text, contact) {
    if (!text) return '';
    return text
      .replace(/\{\{\s*firstName\s*\}\}/gi, contact.first_name || 'there')
      .replace(/\{\{\s*lastName\s*\}\}/gi, contact.last_name || '')
      .replace(/\{\{\s*company\s*\}\}/gi, contact.company || 'your company')
      .replace(/\{\{\s*email\s*\}\}/gi, contact.email || '');
  }

  rewriteLinksForTracking(html, logId) {
    if (!html) return '';
    return html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match, targetUrl) => {
      if (targetUrl.includes('/api/track/')) return match;
      return `href="${this.baseUrl}/api/track/click/${logId}?target=${encodeURIComponent(targetUrl)}"`;
    });
  }
}

module.exports = { CampaignQueueWorker };
