/**
 * supabaseClient.js
 *
 * If Auxosys-Backend already has a shared Supabase client somewhere
 * (e.g. src/lib/supabase.js), delete this file and import that one
 * instead — this exists so the certificate module is drop-in even
 * before wiring, but you shouldn't end up with two separate clients
 * in the same service long-term.
 */

const supabase = require('../config/supabaseClient');

const BUCKET = process.env.SUPABASE_CERT_BUCKET || 'certificates';

/**
 * Uploads a buffer to the certificates bucket and returns its public URL.
 * @param {string} path     e.g. "signatures/uuid.png" or "pdfs/uuid.pdf"
 * @param {Buffer} buffer
 * @param {string} contentType
 */
async function uploadToStorage(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { supabase, uploadToStorage, BUCKET };
