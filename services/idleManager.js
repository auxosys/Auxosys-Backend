/**
 * idleManager.js
 *
 * This is what makes mail arrive "instantly" in the admin panel
 * instead of on a 30-60s polling loop. IMAP IDLE is a standard
 * extension (RFC 2177) where the client opens a connection, tells
 * the server "let me know if anything changes," and the server
 * pushes a notification the moment new mail arrives — no polling.
 *
 * One persistent connection per mailbox is kept open here for the
 * lifetime of the backend process. If a connection drops (network
 * blip, token expiry, server restart), it's automatically reconnected
 * with backoff.
 *
 * This needs to run in a long-lived Node process — NOT inside a
 * serverless function that scales to zero, since the whole point is
 * an open persistent socket. If your Auxosys-Backend runs on
 * something serverless, this manager needs to live in a separate
 * always-on worker process instead (see MOUNT.md).
 */

const { ImapFlow } = require('imapflow');
const { decrypt } = require('./encryption');
const { getFreshAccessToken } = require('./googleOAuthService');
const { fetchMessagesPage } = require('./imapService');

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;

class IdleManager {
  constructor(supabase, io) {
    this.supabase = supabase;
    this.io = io; // socket.io server instance — see websocket/socketServer.js
    this.connections = new Map(); // mailboxId -> { client, reconnectDelay }
  }

  /** Call once at server startup for every mailbox with status = 'connected'. */
  async startAll() {
    const { data: mailboxes } = await this.supabase
      .from('mailboxes')
      .select('id, email_address, auth_type, app_password, imap_host, imap_port, status')
      .in('status', ['connected', 'connecting']);

    for (const mailbox of mailboxes || []) {
      this.start(mailbox.id);
    }
  }

  /** Starts (or restarts) IDLE watching for one mailbox. */
  async start(mailboxId) {
    if (this.connections.has(mailboxId)) return; // already running

    const { data: mailbox } = await this.supabase
      .from('mailboxes')
      .select('id, email_address, auth_type, app_password, imap_host, imap_port, status')
      .eq('id', mailboxId)
      .single();
    if (!mailbox) return;

    this.connections.set(mailboxId, { client: null, reconnectDelay: RECONNECT_DELAY_MS });
    this._connect(mailbox);
  }

  /** Stops watching a mailbox (e.g. admin disconnected it). */
  async stop(mailboxId) {
    const entry = this.connections.get(mailboxId);
    if (entry?.client) {
      try { await entry.client.logout(); } catch (_) {}
    }
    this.connections.delete(mailboxId);
  }

  async _connect(mailbox) {
    try {
      const auth = mailbox.auth_type === 'oauth2'
        ? { user: mailbox.email_address, accessToken: await getFreshAccessToken(mailbox, this.supabase) }
        : { user: mailbox.email_address, pass: decrypt(mailbox.app_password) };

      const client = new ImapFlow({
        host: mailbox.imap_host,
        port: mailbox.imap_port,
        secure: true,
        auth,
        logger: false,
      });

      client.on('exists', async (data) => {
        // New message(s) arrived — fetch just the newest and push it.
        await this._handleNewMail(mailbox);
      });

      client.on('close', () => this._scheduleReconnect(mailbox));
      client.on('error', () => this._scheduleReconnect(mailbox));

      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      lock.release(); // release the lock but keep the mailbox selected for IDLE

      await this.supabase.from('mailboxes').update({ status: 'connected', last_error: null }).eq('id', mailbox.id);

      const entry = this.connections.get(mailbox.id);
      if (entry) {
        entry.client = client;
        entry.reconnectDelay = RECONNECT_DELAY_MS; // reset backoff on success
      }

      // ImapFlow enters IDLE automatically between commands when idle() is called.
      client.idle();
    } catch (err) {
      console.error(`IMAP IDLE connect failed for ${mailbox.email_address}:`, err.message);
      await this.supabase
        .from('mailboxes')
        .update({ status: 'error', last_error: err.message })
        .eq('id', mailbox.id);
      this._scheduleReconnect(mailbox);
    }
  }

  _scheduleReconnect(mailbox) {
    const entry = this.connections.get(mailbox.id);
    if (!entry) return; // stop() was called — don't reconnect
    const delay = entry.reconnectDelay || RECONNECT_DELAY_MS;
    setTimeout(() => this._connect(mailbox), delay);
    entry.reconnectDelay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
  }

  async _handleNewMail(mailbox) {
    try {
      const messages = await fetchMessagesPage(mailbox, this.supabase, 'INBOX', { limit: 5 });
      if (messages.length === 0) return;

      for (const msg of messages) {
        await this.supabase
          .from('mailbox_messages')
          .upsert({ mailbox_id: mailbox.id, ...msg }, { onConflict: 'mailbox_id,folder,uid' });

        // Check if this incoming message is a reply to an outreach campaign log
        if (msg.from_address) {
          try {
            const { data: logs } = await this.supabase
              .from('campaign_logs')
              .select('id, replied_at')
              .eq('recipient_email', msg.from_address)
              .eq('status', 'sent');

            if (logs && logs.length > 0) {
              const nowIso = new Date().toISOString();
              for (const l of logs) {
                if (!l.replied_at) {
                  await this.supabase.from('campaign_logs').update({ replied_at: nowIso }).eq('id', l.id);
                  console.log(`[IdleManager] Outreach reply detected from ${msg.from_address}! Marked log ${l.id} as replied.`);
                }
              }
            }
          } catch (replyErr) {
            console.error('[IdleManager] Reply tracking error:', replyErr.message);
          }
        }
      }

      await this.supabase.from('mailboxes').update({ last_synced_at: new Date().toISOString() }).eq('id', mailbox.id);

      // Push to every admin currently viewing this mailbox in real time.
      this.io.to(`mailbox:${mailbox.id}`).emit('new-mail', {
        mailboxId: mailbox.id,
        messages,
      });
    } catch (err) {
      console.error(`Failed to sync new mail for ${mailbox.email_address}:`, err.message);
    }
  }
}

module.exports = { IdleManager };
