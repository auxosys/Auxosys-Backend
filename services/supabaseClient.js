require('dotenv').config();
const supabase = require('../config/supabaseClient');

const DEFAULT_BUCKET = 'mailbox-attachments';

async function uploadToStorage(path, buffer, contentType, bucket = DEFAULT_BUCKET) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { supabase, uploadToStorage };
