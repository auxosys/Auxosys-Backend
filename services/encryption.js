/**
 * encryption.js
 *
 * Mailbox credentials (OAuth refresh tokens, app passwords) are the
 * single most sensitive thing in this module — anyone with these can
 * read and send mail as your company. They are NEVER stored in
 * plaintext. This uses AES-256-GCM with a key from your environment,
 * not hardcoded.
 *
 * Generate a key once with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * and put it in MAILBOX_ENCRYPTION_KEY in your .env — losing this key
 * means every connected mailbox has to be reconnected from scratch.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'MAILBOX_ENCRYPTION_KEY is missing or not a 64-char hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64, so it's one column value.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(stored) {
  if (stored == null) return null;
  const raw = Buffer.from(stored, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
