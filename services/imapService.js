/**
 * imapService.js
 *
 * Wraps ImapFlow (https://github.com/postalsys/imapflow) with the
 * two auth paths this module supports:
 *   - oauth2: Gmail/Google Workspace, using a fresh access token
 *     turned into an XOAUTH2 string
 *   - app_password: any other IMAP provider, plain username/password
 *
 * Every function here opens a short-lived connection for a single
 * operation and closes it — the one exception is idleManager.js,
 * which deliberately keeps one long-lived connection per mailbox
 * open for push notifications.
 */

const { ImapFlow } = require('imapflow');
const { decrypt } = require('./encryption');
const { getFreshAccessToken, buildXOAuth2Token } = require('./googleOAuthService');
const { sanitizeEmailHtml } = require('./sanitizeHtml');

async function buildAuth(mailboxRow, supabase) {
  if (mailboxRow.auth_type === 'oauth2') {
    const accessToken = await getFreshAccessToken(mailboxRow, supabase);
    return {
      user: mailboxRow.email_address,
      accessToken, // ImapFlow accepts a raw access token directly when xoauth2 isn't passed
    };
  }
  return {
    user: mailboxRow.email_address,
    pass: decrypt(mailboxRow.app_password),
  };
}

async function openConnection(mailboxRow, supabase) {
  const auth = await buildAuth(mailboxRow, supabase);
  const client = new ImapFlow({
    host: mailboxRow.imap_host,
    port: mailboxRow.imap_port,
    secure: true,
    auth,
    logger: false,
  });
  await client.connect();
  return client;
}

/** Lists folders/mailboxes on the server (INBOX, Sent, Drafts, etc). */
async function listFolders(mailboxRow, supabase) {
  const client = await openConnection(mailboxRow, supabase);
  try {
    const tree = await client.listMailboxes();
    return flattenFolders(tree);
  } finally {
    await client.logout();
  }
}

function flattenFolders(node, out = []) {
  for (const child of node?.folders?.values?.() || []) {
    out.push({ path: child.path, name: child.name, specialUse: child.specialUse || null });
    flattenFolders(child, out);
  }
  return out;
}

/**
 * Fetches message metadata + body for a page of a folder, newest first.
 * Used both by the initial backfill and by the idle manager when new
 * mail arrives. Returns plain objects ready to upsert into mailbox_messages.
 */
async function fetchMessagesPage(mailboxRow, supabase, folder, { limit = 30, beforeUid = null } = {}) {
  const client = await openConnection(mailboxRow, supabase);
  const results = [];
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const box = client.mailbox;
      let range = '1:*';
      if (beforeUid) range = `1:${beforeUid - 1}`;

      const uids = await client.search({ all: true }, { uid: true });
      const sorted = uids.sort((a, b) => b - a); // newest UID first
      const page = (beforeUid ? sorted.filter((u) => u < beforeUid) : sorted).slice(0, limit);
      if (page.length === 0) return [];

      for await (const msg of client.fetch(page, {
        envelope: true, flags: true, bodyStructure: true, source: false, uid: true,
      }, { uid: true })) {
        results.push(await toMessageRecord(client, msg, folder));
      }
    } finally {
      lock.release();
    }
    return results;
  } finally {
    await client.logout();
  }
}

/** Fetches full body (text + sanitized HTML) for a single message by UID. */
async function fetchMessageBody(mailboxRow, supabase, folder, uid) {
  const client = await openConnection(mailboxRow, supabase);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      const parsed = await parseSource(message.source);
      return parsed;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

async function parseSource(rawSource) {
  const { simpleParser } = require('mailparser');
  const parsed = await simpleParser(rawSource);
  return {
    bodyText: parsed.text || '',
    bodyHtml: sanitizeEmailHtml(parsed.html || parsed.textAsHtml || ''),
    attachments: (parsed.attachments || []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      content: a.content, // Buffer — controller decides whether to persist to Storage
    })),
  };
}

async function toMessageRecord(client, msg, folder) {
  const envelope = msg.envelope || {};
  return {
    folder,
    uid: msg.uid,
    message_id: envelope.messageId || null,
    in_reply_to: envelope.inReplyTo || null,
    from_name: envelope.from?.[0]?.name || null,
    from_address: envelope.from?.[0]?.address || null,
    to_addresses: (envelope.to || []).map((t) => ({ name: t.name, address: t.address })),
    cc_addresses: (envelope.cc || []).map((c) => ({ name: c.name, address: c.address })),
    subject: envelope.subject || '(no subject)',
    is_read: msg.flags?.has('\\Seen') || false,
    is_starred: msg.flags?.has('\\Flagged') || false,
    has_attachments: hasAttachments(msg.bodyStructure),
    received_at: envelope.date ? new Date(envelope.date).toISOString() : null,
  };
}

function hasAttachments(bodyStructure) {
  if (!bodyStructure) return false;
  const check = (node) => {
    if (node.disposition === 'attachment') return true;
    if (node.childNodes) return node.childNodes.some(check);
    return false;
  };
  return check(bodyStructure);
}

/** Sets/clears the \Seen flag to match is_read. */
async function setReadFlag(mailboxRow, supabase, folder, uid, isRead) {
  const client = await openConnection(mailboxRow, supabase);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      if (isRead) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      else await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/** Sets/clears the \Flagged (starred) flag. */
async function setStarredFlag(mailboxRow, supabase, folder, uid, isStarred) {
  const client = await openConnection(mailboxRow, supabase);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      if (isStarred) await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
      else await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/** Moves a message to another folder (e.g. Trash, Archive). */
async function moveMessage(mailboxRow, supabase, fromFolder, uid, toFolder) {
  const client = await openConnection(mailboxRow, supabase);
  try {
    const lock = await client.getMailboxLock(fromFolder);
    try {
      await client.messageMove(uid, toFolder, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

module.exports = {
  openConnection,
  listFolders,
  fetchMessagesPage,
  fetchMessageBody,
  setReadFlag,
  setStarredFlag,
  moveMessage,
};
