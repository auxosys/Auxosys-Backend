const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../services/supabaseClient');
const { encrypt } = require('../services/encryption');
const { getAuthUrl, exchangeCodeForTokens } = require('../services/googleOAuthService');
const { listFolders } = require('../services/imapService');

function isSuperAdmin(user) {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase();
  return email === 'admin@auxosys.com' || email === 'auxosys@gmail.com';
}

/** GET /api/mailboxes */
async function listMailboxes(req, res) {
  try {
    const user = req.user;
    const isSuper = isSuperAdmin(user);

    let { data: senders } = await supabase
      .from('sender_emails')
      .select('id, email, name, department')
      .order('created_at', { ascending: true });

    if (!senders || senders.length === 0) {
      const { syncBrevoSendersInternal } = require('./outreachController');
      if (typeof syncBrevoSendersInternal === 'function') {
        await syncBrevoSendersInternal(supabase);
        const { data: synced } = await supabase
          .from('sender_emails')
          .select('id, email, name, department')
          .order('created_at', { ascending: true });
        senders = synced || [];
      }
    }

    // Filter by per-user sender permissions if non-superadmin user
    if (!isSuper && user) {
      const isUuid = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(str));
      const userIdentifiers = [user.id, user._id, user.user_metadata?.id].filter(Boolean).filter(isUuid);
      
      let perms = [];
      if (userIdentifiers.length > 0) {
        const { data: pData } = await supabase
          .from('user_sender_permissions')
          .select('sender_email_id')
          .in('user_id', userIdentifiers);
        perms = pData || [];
      }

      if (perms && perms.length > 0) {
        const allowedSet = new Set(perms.map(p => String(p.sender_email_id).toLowerCase()));
        senders = (senders || []).filter(s => {
          const sId = String(s.id).toLowerCase();
          const sEmail = String(s.email || '').toLowerCase();
          return allowedSet.has(sId) || allowedSet.has(sEmail);
        });
      } else {
        // No explicit permissions found for this non-superadmin user
        senders = [];
      }
    }

    const mailboxes = [];

    // Only show "All Company Senders" option if user is Superadmin OR has access to multiple senders
    if (isSuper || (senders && senders.length > 1)) {
      mailboxes.push({
        id: 'all',
        email_address: 'All Company Senders',
        display_name: 'All Sender Emails',
        provider: 'brevo',
        status: 'connected'
      });
    }

    (senders || []).forEach(s => {
      mailboxes.push({
        id: s.id,
        email_address: s.email,
        display_name: s.name || s.email,
        department: s.department,
        provider: 'brevo',
        status: 'connected'
      });
    });

    return res.json({ mailboxes });
  } catch (err) {
    console.error('listMailboxes failed:', err);
    return res.json({ mailboxes: [] });
  }
}

/**
 * GET /api/mailboxes/oauth/start
 * Redirects the admin to Google's consent screen.
 */
function startGoogleOAuth(req, res) {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID.trim() === '') {
    return res.status(400).send(`
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 550px; margin: 40px auto; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #dc2626; font-size: 20px;">Google OAuth Configuration Required</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.5;">
          To connect Google Workspace via 1-click OAuth, please configure <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in your <code>Auxosys-Backend/.env</code> file.
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.5;">
          <strong>Alternative Instant Connection:</strong> You can connect your email account immediately using an <strong>App Password</strong> directly on the connect screen without needing a Google Cloud project!
        </p>
        <a href="javascript:history.back()" style="display: inline-block; padding: 10px 18px; border-radius: 6px; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500;">← Return to Admin Panel</a>
      </div>
    `);
  }
  const state = req.user?.id || 'anonymous';
  const url = getAuthUrl(state);
  res.redirect(url);
}

/**
 * GET /api/mailboxes/oauth/callback?code=...&state=...
 * Google redirects here after consent. Exchanges the code for tokens,
 * fetches the connected email address, and stores the mailbox row.
 */
async function googleOAuthCallback(req, res) {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code.');

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Happens if the admin previously connected without revoking access first —
      // Google only issues a refresh_token on the FIRST consent for a given app+account.
      return res.status(400).send(
        'No refresh token returned. Revoke this app\'s access at ' +
        'https://myaccount.google.com/permissions and try connecting again.'
      );
    }

    // Decode the email address from the ID token payload (no extra API call needed).
    const idTokenPayload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString('utf8'));
    const emailAddress = idTokenPayload.email;

    const { data, error } = await supabase
      .from('mailboxes')
      .upsert({
        id: uuidv4(),
        email_address: emailAddress,
        provider: 'gmail',
        auth_type: 'oauth2',
        oauth_refresh_token: encrypt(tokens.refresh_token),
        oauth_access_token: encrypt(tokens.access_token),
        oauth_token_expires_at: new Date(tokens.expiry_date).toISOString(),
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        status: 'connecting',
        connected_by: req.user?.id || null,
      }, { onConflict: 'email_address' })
      .select()
      .single();

    if (error) throw error;

    // Kick off IDLE watching immediately — see app entry point wiring in MOUNT.md.
    if (req.idleManager) await req.idleManager.start(data.id);

    // Redirect back into the admin panel's mailbox settings screen.
    res.redirect(`${process.env.ADMIN_PANEL_URL || '/'}/mail/settings?connected=${data.id}`);
  } catch (err) {
    console.error('googleOAuthCallback failed:', err);
    res.status(500).send('Failed to complete Google connection. Check server logs.');
  }
}

/**
 * POST /api/mailboxes/connect-app-password
 * body: { email_address, display_name?, app_password, imap_host, imap_port, smtp_host, smtp_port }
 * For any non-Gmail provider.
 */
async function connectWithAppPassword(req, res) {
  try {
    const { email_address, display_name, app_password, imap_host, imap_port, smtp_host, smtp_port } = req.body;
    if (!email_address || !app_password || !imap_host || !smtp_host) {
      return res.status(400).json({ error: 'email_address, app_password, imap_host, and smtp_host are required.' });
    }

    const { data, error } = await supabase
      .from('mailboxes')
      .upsert({
        id: uuidv4(),
        email_address,
        display_name: display_name || null,
        provider: 'other',
        auth_type: 'app_password',
        app_password: encrypt(app_password),
        imap_host,
        imap_port: imap_port || 993,
        smtp_host,
        smtp_port: smtp_port || 465,
        status: 'connecting',
        connected_by: req.user?.id || null,
      }, { onConflict: 'email_address' })
      .select()
      .single();

    if (error) throw error;

    // Verify the credentials actually work before reporting success.
    try {
      await listFolders(data, supabase);
      await supabase.from('mailboxes').update({ status: 'connected' }).eq('id', data.id);
    } catch (verifyErr) {
      await supabase.from('mailboxes').update({ status: 'error', last_error: verifyErr.message }).eq('id', data.id);
      return res.status(422).json({ error: `Connected but verification failed: ${verifyErr.message}` });
    }

    if (req.idleManager) await req.idleManager.start(data.id);

    res.status(201).json({ mailbox: data });
  } catch (err) {
    console.error('connectWithAppPassword failed:', err);
    res.status(500).json({ error: 'Failed to connect mailbox.' });
  }
}

/** DELETE /api/mailboxes/:id */
async function disconnectMailbox(req, res) {
  try {
    const { id } = req.params;
    if (req.idleManager) await req.idleManager.stop(id);

    const { error } = await supabase.from('mailboxes').update({ status: 'disconnected' }).eq('id', id);
    if (error) throw error;

    res.json({ disconnected: true });
  } catch (err) {
    console.error('disconnectMailbox failed:', err);
    res.status(500).json({ error: 'Failed to disconnect mailbox.' });
  }
}

/** GET /api/mailboxes/:id/folders */
async function getFolders(req, res) {
  try {
    const { data: mailbox, error } = await supabase.from('mailboxes').select('*').eq('id', req.params.id).single();
    if (error || !mailbox) return res.status(404).json({ error: 'Mailbox not found.' });

    const folders = await listFolders(mailbox, supabase);
    res.json({ folders });
  } catch (err) {
    console.error('getFolders failed:', err);
    res.status(500).json({ error: 'Failed to list folders.' });
  }
}

module.exports = {
  listMailboxes,
  startGoogleOAuth,
  googleOAuthCallback,
  connectWithAppPassword,
  disconnectMailbox,
  getFolders,
};
