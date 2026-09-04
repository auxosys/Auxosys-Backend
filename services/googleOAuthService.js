/**
 * googleOAuthService.js
 *
 * Handles the OAuth2 dance for Gmail/Google Workspace mailboxes.
 *
 * SETUP REQUIRED (you do this once, in your own Google account —
 * see backend/MOUNT.md for the full click-by-click walkthrough):
 *   1. Create a project in Google Cloud Console
 *   2. Enable the Gmail API
 *   3. Create an OAuth 2.0 Client ID (type: Web application)
 *   4. Add your redirect URI (e.g. https://admin.auxosys.com/api/mailboxes/oauth/callback)
 *   5. Put the Client ID + Secret in your .env as
 *      GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Scope requested is https://mail.google.com/ — full IMAP/SMTP access.
 * This is intentionally broad (it's what IMAP/SMTP over OAuth requires)
 * rather than the narrower gmail.readonly/gmail.send scopes, which
 * only work with the Gmail REST API, not raw IMAP/SMTP.
 */

const { google } = require('googleapis');
const { encrypt, decrypt } = require('./encryption');

const SCOPES = ['https://mail.google.com/'];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

/** Step 1: send the admin to Google's consent screen. */
function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // required to get a refresh_token back
    prompt: 'consent',      // forces refresh_token on every connect, not just the first time
    scope: SCOPES,
    state, // pass through e.g. the admin user id so the callback knows who connected it
  });
}

/** Step 2: exchange the ?code=... from the callback for tokens. */
async function exchangeCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

/**
 * Returns a valid (non-expired) access token for a mailbox row,
 * refreshing and persisting it first if it's stale. Call this right
 * before every IMAP/SMTP connection attempt.
 */
async function getFreshAccessToken(mailboxRow, supabase) {
  const refreshToken = decrypt(mailboxRow.oauth_refresh_token);
  const expiresAt = mailboxRow.oauth_token_expires_at ? new Date(mailboxRow.oauth_token_expires_at) : null;
  const stillValid = expiresAt && expiresAt.getTime() - Date.now() > 60_000; // 1 min buffer

  if (stillValid && mailboxRow.oauth_access_token) {
    return decrypt(mailboxRow.oauth_access_token);
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();

  await supabase
    .from('mailboxes')
    .update({
      oauth_access_token: encrypt(credentials.access_token),
      oauth_token_expires_at: new Date(credentials.expiry_date).toISOString(),
    })
    .eq('id', mailboxRow.id);

  return credentials.access_token;
}

/**
 * Builds the base64 XOAUTH2 string IMAP/SMTP expect for the AUTH
 * XOAUTH2 command. This is the bridge between "I have a Google OAuth
 * access token" and "IMAP/SMTP will accept it as a login."
 */
function buildXOAuth2Token(emailAddress, accessToken) {
  const authString = `user=${emailAddress}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString).toString('base64');
}

module.exports = { getAuthUrl, exchangeCodeForTokens, getFreshAccessToken, buildXOAuth2Token, SCOPES };
