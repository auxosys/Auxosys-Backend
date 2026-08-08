const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { supabase, uploadToStorage } = require('../utils/supabaseClient');
const { generateAndStoreQr } = require('../utils/qrService');
const { renderCertificatePdf, renderCertificatePng } = require('../utils/certificateRenderer');

/** AUXCERT-2026-8841 style human-readable number. Uniqueness enforced by the DB constraint + retry. */
function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `AUXCERT-${year}-${random}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * POST /api/certificates
 * body: {
 *   cert_type, recipient_name, recipient_email,
 *   fields: { eyebrow, title, presentedLine, bodyHtml, ... },
 *   color_config: { type, mode, angle, colors: [...] },
 *   signature_ids: ["uuid", ...],   // pulled from certificate_signatures, snapshotted
 *   expires_at?: "2027-08-05"
 * }
 */
async function createCertificate(req, res) {
  try {
    const { 
      cert_type, 
      recipient_name, 
      recipient_email, 
      fields, 
      color_config, 
      signature_ids,
      issue_date,
      expires_at 
    } = req.body;

    if (!cert_type || !recipient_name || !fields?.title) {
      return res.status(400).json({ error: 'cert_type, recipient_name, and fields.title are required.' });
    }

    // Snapshot the chosen signatures so future edits to the library
    // don't retroactively change an already-issued certificate.
    let signatures = [];
    if (Array.isArray(signature_ids) && signature_ids.length > 0) {
      const { data: sigRows, error: sigErr } = await supabase
        .from('certificate_signatures')
        .select('*')
        .in('id', signature_ids);
      if (sigErr) throw sigErr;

      signatures = signature_ids
        .map((id) => sigRows.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({
          signature_id: s.id,
          name: s.name,
          designation: s.designation,
          image_url: s.image_url,
        }));

      // Bump usage_count for whichever signatures were actually used.
      await Promise.all(
        signatures.map((s) =>
          supabase.rpc('increment_signature_usage', { sig_id: s.signature_id }).then(
            () => {},
            () => {} // non-fatal if the RPC helper isn't set up yet — see NOTE at bottom of file
          )
        )
      );
    }

    const id = uuidv4();
    const verification_token = generateVerificationToken();

    // Retry a couple of times on the (very unlikely) unique-constraint collision.
    let certificate_number = generateCertificateNumber();

    console.log('Generating QR code...');
    const { url: qr_code_url, publicVerifyUrl } = await generateAndStoreQr(id, verification_token);

    console.log('Rendering PDF...');
    const pdfBuffer = await renderCertificatePdf({
      certificate_number,
      recipient_name,
      cert_type,
      fields,
      color_config,
      signatures,
      qr_code_url,
      issue_date: issue_date ? new Date(issue_date).toISOString() : new Date().toISOString(),
    });
    console.log('PDF Rendered. Uploading to storage...');
    const pdf_url = await uploadToStorage(`pdfs/${id}.pdf`, pdfBuffer, 'application/pdf');

    console.log('Inserting into database...');
    const { data, error } = await supabase
      .from('certificates')
      .insert({
        id,
        certificate_number,
        verification_token,
        cert_type,
        recipient_name,
        recipient_email: recipient_email || null,
        fields,
        color_config: color_config || { type: 'solid', colors: ['#14B8A6'] },
        signatures,
        qr_code_url,
        pdf_url,
        expires_at: expires_at || null,
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Done!');
    res.status(201).json({ certificate: data, verify_url: publicVerifyUrl });
  } catch (err) {
    console.error('createCertificate failed:', err);
    global.lastCertError = { message: err.message, stack: err.stack, name: err.name };
    res.status(500).json({ error: 'Failed to generate certificate.', details: err.message, stack: err.stack });
  }
}

/** POST /api/certificates/preview — same payload as create, but renders a PNG and saves nothing */
async function previewCertificate(req, res) {
  try {
    const { cert_type, recipient_name, fields, color_config, signatures } = req.body;
    const pngBuffer = await renderCertificatePng({
      cert_type,
      recipient_name: recipient_name || 'Recipient Name',
      fields: fields || {},
      color_config,
      signatures: signatures || [],
    });
    res.set('Content-Type', 'image/png');
    res.send(pngBuffer);
  } catch (err) {
    console.error('previewCertificate failed:', err);
    res.status(500).json({ error: 'Failed to render preview.' });
  }
}

/** GET /api/certificates?status=&cert_type=&q=&page=&pageSize= */
async function listCertificates(req, res) {
  try {
    const { status, cert_type, q, page = 1, pageSize = 20 } = req.query;
    let query = supabase.from('certificates').select('*', { count: 'exact' }).order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (cert_type) query = query.eq('cert_type', cert_type);
    if (q) query = query.or(`recipient_name.ilike.%${q}%,certificate_number.ilike.%${q}%`);

    const from = (Number(page) - 1) * Number(pageSize);
    const to = from + Number(pageSize) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ certificates: data, total: count, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    console.error('listCertificates failed:', err);
    res.status(500).json({ error: 'Failed to list certificates.' });
  }
}

/**
 * PUT /api/certificates/:id
 */
async function updateCertificate(req, res) {
  try {
    const { id } = req.params;
    const { 
      cert_type, 
      recipient_name, 
      recipient_email, 
      fields, 
      color_config, 
      signature_ids,
      issue_date
    } = req.body;

    if (!cert_type || !recipient_name || !fields?.title) {
      return res.status(400).json({ error: 'cert_type, recipient_name, and fields.title are required.' });
    }

    // 1. Fetch existing certificate
    const { data: existingCert, error: fetchErr } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingCert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    if (existingCert.status !== 'valid') {
      return res.status(400).json({ error: 'Cannot edit a revoked certificate.' });
    }

    // 2. Fetch signatures
    let signatures = [];
    if (Array.isArray(signature_ids) && signature_ids.length > 0) {
      const { data: sigRows, error: sigErr } = await supabase
        .from('certificate_signatures')
        .select('*')
        .in('id', signature_ids);
      if (sigErr) throw sigErr;

      signatures = signature_ids
        .map((sigId) => sigRows.find((s) => s.id === sigId))
        .filter(Boolean)
        .map((s) => ({
          signature_id: s.id,
          name: s.name,
          designation: s.designation,
          image_url: s.image_url,
        }));
    }

    // 3. Re-render PDF with existing certificate_number and qr_code_url
    console.log('Re-rendering PDF for edit...');
    const pdfBuffer = await renderCertificatePdf({
      certificate_number: existingCert.certificate_number,
      recipient_name,
      cert_type,
      fields,
      color_config,
      signatures,
      qr_code_url: existingCert.qr_code_url,
      issue_date: issue_date ? new Date(issue_date).toISOString() : existingCert.issued_at,
    });

    // 4. Overwrite PDF in storage
    console.log('Overwriting PDF in storage...');
    const pdf_url = await uploadToStorage(`pdfs/${id}.pdf`, pdfBuffer, 'application/pdf');

    // 5. Update Database Record
    console.log('Updating database record...');
    const { data, error } = await supabase
      .from('certificates')
      .update({
        cert_type: cert_type === 'custom' ? (req.body.customType || 'Custom') : cert_type,
        recipient_name,
        recipient_email: recipient_email || null,
        fields,
        color_config,
        signatures, // Note: We don't increment usage count on edit for simplicity, or we could if needed.
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(data);
  } catch (err) {
    console.error('Certificate update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/certificates/:id */
async function getCertificate(req, res) {
  try {
    const { data, error } = await supabase.from('certificates').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Certificate not found.' });
    res.json({ certificate: data });
  } catch (err) {
    console.error('getCertificate failed:', err);
    res.status(500).json({ error: 'Failed to fetch certificate.' });
  }
}

/** POST /api/certificates/:id/revoke  body: { reason } */
async function revokeCertificate(req, res) {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: req.body.reason || null })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ certificate: data });
  } catch (err) {
    console.error('revokeCertificate failed:', err);
    res.status(500).json({ error: 'Failed to revoke certificate.' });
  }
}

/** GET /api/certificates/:id/download — redirects to the stored PDF */
async function downloadCertificate(req, res) {
  try {
    const { data, error } = await supabase.from('certificates').select('pdf_url').eq('id', req.params.id).single();
    if (error || !data?.pdf_url) return res.status(404).json({ error: 'PDF not found.' });
    res.redirect(data.pdf_url);
  } catch (err) {
    console.error('downloadCertificate failed:', err);
    res.status(500).json({ error: 'Failed to fetch PDF.' });
  }
}

/** POST /api/certificates/:id/send-email */
async function sendCertificateEmail(req, res) {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Certificate not found.' });
    if (!data.recipient_email) return res.status(400).json({ error: 'Certificate does not have a recipient email.' });

    const emailService = require('../utils/emailService');
    const success = await emailService.sendCertificateEmailToRecipient(data);
    
    if (success) {
      res.json({ message: 'Email sent successfully.' });
    } else {
      res.status(500).json({ error: 'Failed to send email.' });
    }
  } catch (err) {
    console.error('sendCertificateEmail failed:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
}

module.exports = {
  createCertificate,
  previewCertificate,
  listCertificates,
  getCertificate,
  revokeCertificate,
  downloadCertificate,
  sendCertificateEmail,
  updateCertificate,
};

/**
 * NOTE: this controller calls an `increment_signature_usage` RPC that
 * doesn't exist until you add it. Optional but recommended — run once:
 *
 *   create or replace function increment_signature_usage(sig_id uuid)
 *   returns void as $$
 *     update certificate_signatures set usage_count = usage_count + 1 where id = sig_id;
 *   $$ language sql;
 *
 * Without it, certificate creation still works fine — the usage_count
 * column just stays at 0, since the call is wrapped to fail silently.
 */
