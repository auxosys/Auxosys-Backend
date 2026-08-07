const { supabase } = require('../utils/supabaseClient');

/**
 * GET /api/verify/:id?t=verification_token
 *
 * Public, unauthenticated. Used by the /verify/[id] page on the main
 * site. Deliberately returns the SAME shape whether the certificate
 * exists or not, revoked or not — the frontend decides how to display
 * each `result` value. Every lookup is logged for the admin's
 * "Verification Requests" view.
 */
async function verifyCertificate(req, res) {
  const { id } = req.params;
  const { t } = req.query;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const logAttempt = async (result, certificateId = null) => {
    try {
      await supabase.from('certificate_verification_logs').insert({
        certificate_id: certificateId,
        lookup_value: id,
        result,
        ip_address: ip,
        user_agent: userAgent,
      });
    } catch (_) {
      // Logging failures should never block the actual verification response.
    }
  };

  try {
    const { data: cert, error } = await supabase
      .from('certificates')
      .select('id, certificate_number, cert_type, status, recipient_name, fields, issued_at, expires_at, revoked_at, revoked_reason, pdf_url, verification_token')
      .eq('id', id)
      .single();

    if (error || !cert) {
      await logAttempt('not_found');
      return res.status(404).json({ result: 'not_found' });
    }

    // Token must match if one was provided — protects against certificate
    // IDs being guessed/enumerated (they're UUIDs so this is belt-and-braces).
    if (t && cert.verification_token !== t) {
      await logAttempt('not_found');
      return res.status(404).json({ result: 'not_found' });
    }

    let result = cert.status; // 'valid' | 'revoked'
    if (result === 'valid' && cert.expires_at && new Date(cert.expires_at) < new Date()) {
      result = 'expired';
    }

    await logAttempt(result, cert.id);

    // Never leak the verification_token itself back to the client.
    const { verification_token, ...safeCert } = cert;

    res.json({
      result,
      certificate: {
        id: safeCert.id,
        certificate_number: safeCert.certificate_number,
        cert_type: safeCert.cert_type,
        recipient_name: safeCert.recipient_name,
        title: safeCert.fields?.title,
        employeeId: safeCert.fields?.employeeId,
        issued_at: safeCert.issued_at,
        expires_at: safeCert.expires_at,
        revoked_at: safeCert.revoked_at,
        revoked_reason: result === 'revoked' ? safeCert.revoked_reason : undefined,
        pdf_url: result === 'valid' ? safeCert.pdf_url : undefined,
      },
    });
  } catch (err) {
    console.error('verifyCertificate failed:', err);
    res.status(500).json({ error: 'Verification temporarily unavailable.' });
  }
}

/** GET /api/verify/search?q=CERT-NUMBER-OR-EMAIL — used by the public "search" box */
async function searchCertificates(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ error: 'Enter at least 3 characters to search.' });
  }
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select('id, certificate_number, recipient_name, cert_type, status, fields')
      .or(`certificate_number.ilike.%${q}%,recipient_name.ilike.%${q}%,fields->>employeeId.ilike.%${q}%`)
      .limit(10);
    if (error) throw error;
    res.json({ results: data });
  } catch (err) {
    console.error('searchCertificates failed:', err);
    res.status(500).json({ error: 'Search temporarily unavailable.' });
  }
}

module.exports = { verifyCertificate, searchCertificates };
