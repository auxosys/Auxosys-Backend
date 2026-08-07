const { v4: uuidv4 } = require('uuid');
const { supabase, uploadToStorage } = require('../utils/supabaseClient');
const { processSignature } = require('../utils/signatureProcessor');

/**
 * POST /api/certificates/signatures
 * multipart/form-data: file, name, designation, department?, organization?, threshold?
 */
async function uploadSignature(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded (field name: "file").' });
    }
    const { name, designation, department, organization, threshold } = req.body;
    if (!name || !designation) {
      return res.status(400).json({ error: 'name and designation are required.' });
    }

    const id = uuidv4();

    // Keep the original for later re-processing (e.g. user wants a
    // different sensitivity without re-uploading).
    const originalUrl = await uploadToStorage(
      `signatures/originals/${id}.${req.file.mimetype.split('/')[1]}`,
      req.file.buffer,
      req.file.mimetype
    );

    const { buffer: processedBuffer } = await processSignature(req.file.buffer, {});

    const imageUrl = await uploadToStorage(`signatures/${id}.png`, processedBuffer, 'image/png');

    const { data, error } = await supabase
      .from('certificate_signatures')
      .insert({
        id,
        name,
        designation,
        department: department || null,
        organization: organization || 'Auxosys',
        image_url: imageUrl,
        original_url: originalUrl,
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ signature: data });
  } catch (err) {
    if (err.code === 'NO_SIGNATURE_DETECTED') {
      return res.status(422).json({ error: err.message, code: err.code });
    }
    console.error('uploadSignature failed:', err);
    res.status(500).json({ error: 'Failed to process signature.' });
  }
}

/** POST /api/certificates/signatures/:id/reprocess — retry with a different threshold */
async function reprocessSignature(req, res) {
  try {
    const { id } = req.params;
    const { name, designation, department } = req.body;

    let query = supabase
      .from('certificate_signatures')
      .select('*')
      .eq('id', id);

    if (req.user && req.user.email !== 'admin@auxosys.com' && req.user.email !== 'auxosys@gmail.com') {
      query = query.eq('created_by', req.user.id);
    }

    const { data: sig, error: fetchErr } = await query.single();
    if (fetchErr || !sig) return res.status(404).json({ error: 'Signature not found.' });
    if (!sig.original_url) return res.status(400).json({ error: 'Original image not retained for this signature.' });

    const originalResp = await fetch(sig.original_url);
    const originalBuffer = Buffer.from(await originalResp.arrayBuffer());

    const { buffer: processedBuffer } = await processSignature(originalBuffer, {});

    const imageUrl = await uploadToStorage(`signatures/${id}.png`, processedBuffer, 'image/png');

    const updatePayload = { image_url: imageUrl };
    if (name) updatePayload.name = name;
    if (designation) updatePayload.designation = designation;
    if (department !== undefined) updatePayload.department = department;

    const { data, error } = await supabase
      .from('certificate_signatures')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ signature: data });
  } catch (err) {
    if (err.code === 'NO_SIGNATURE_DETECTED') {
      return res.status(422).json({ error: err.message, code: err.code });
    }
    console.error('reprocessSignature failed:', err);
    res.status(500).json({ error: 'Failed to reprocess signature.' });
  }
}

/** GET /api/certificates/signatures?active=true */
async function listSignatures(req, res) {
  try {
    let query = supabase.from('certificate_signatures').select('*').order('created_at', { ascending: false });
    if (req.query.active === 'true') query = query.eq('is_active', true);
    
    if (req.user && req.user.email !== 'admin@auxosys.com' && req.user.email !== 'auxosys@gmail.com') {
      query = query.eq('created_by', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ signatures: data });
  } catch (err) {
    console.error('listSignatures failed:', err);
    res.status(500).json({ error: 'Failed to list signatures.' });
  }
}

/** DELETE /api/certificates/signatures/:id — soft delete (keeps history for already-issued certs) */
async function deleteSignature(req, res) {
  try {
    let query = supabase
      .from('certificate_signatures')
      .update({ is_active: false })
      .eq('id', req.params.id);
      
    if (req.user && req.user.email !== 'admin@auxosys.com' && req.user.email !== 'auxosys@gmail.com') {
      query = query.eq('created_by', req.user.id);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    res.json({ signature: data });
  } catch (err) {
    console.error('deleteSignature failed:', err);
    res.status(500).json({ error: 'Failed to delete signature.' });
  }
}

module.exports = { uploadSignature, reprocessSignature, listSignatures, deleteSignature };
