const supabase = require("../config/supabaseClient");
const crypto = require("crypto");

// Helper to hash IP
const hashIP = (ip) => {
  const salt = process.env.IP_SALT || 'auxosys-secret-salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
};

exports.submitConsent = async (req, res) => {
  try {
    const { 
      visitor_id, session_id, consent_id, categories, country_code,
      device_type, page_slug, source, referrer,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      privacy_policy_version, cookie_policy_version, terms_version, consent_version,
      status
    } = req.body;

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip_hash = hashIP(ip);

    // Check if the consent record already exists
    const { data: existingConsent } = await supabase
      .from("cookie_consents")
      .select("*")
      .eq("consent_id", consent_id)
      .single();

    if (existingConsent) {
      // If categories and status are the same, just update timestamps
      if (existingConsent.categories === categories && existingConsent.status === status) {
        const { error } = await supabase
          .from("cookie_consents")
          .update({
            updated_at: new Date().toISOString(),
            last_viewed_at: new Date().toISOString()
          })
          .eq("consent_id", consent_id);
          
        if (error) throw error;
        return res.status(200).json({ success: true, message: "Consent timestamp updated" });
      } else {
        // Record has changed, perform an update and create audit log
        const { error: updateError } = await supabase
          .from("cookie_consents")
          .update({
            categories,
            status,
            country_code,
            device_type,
            page_slug,
            updated_at: new Date().toISOString(),
            last_viewed_at: new Date().toISOString()
          })
          .eq("consent_id", consent_id);

        if (updateError) throw updateError;

        // Create Audit Log (compressed diff)
        const changed_fields = {};
        if (existingConsent.categories !== categories) changed_fields.categories = categories;
        if (existingConsent.status !== status) changed_fields.status = status;

        await supabase.from("cookie_audit_logs").insert([{
          consent_id: existingConsent.id,
          action: "Updated",
          changed_fields
        }]);

        return res.status(200).json({ success: true, message: "Consent updated" });
      }
    } else {
      // Create new consent
      const { data: newConsent, error } = await supabase
        .from("cookie_consents")
        .insert([{
          consent_id, visitor_id, session_id, categories, status,
          country_code, device_type, page_slug, source, referrer,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          privacy_policy_version, cookie_policy_version, terms_version, consent_version,
          ip_hash
        }])
        .select()
        .single();
        
      if (error) throw error;

      await supabase.from("cookie_audit_logs").insert([{
        consent_id: newConsent.id,
        action: "Created",
        changed_fields: { categories, status }
      }]);

      return res.status(201).json({ success: true, message: "Consent recorded" });
    }
  } catch (error) {
    console.error("Error in submitConsent:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cookie_banner_settings")
      .select("version, config")
      .eq("status", "Publish")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error;
    
    res.status(200).json({ success: true, data: data || { version: "v1.0", config: { theme: "light" } } });
  } catch (error) {
    console.error("Error in getConfig:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { theme, position, expiry, status } = req.body;
    
    // We insert a new config version so there is history
    const { data, error } = await supabase
      .from("cookie_banner_settings")
      .insert([
        { 
          version: "v2.0", 
          config: { theme, position, expiry },
          status: status || 'Publish'
        }
      ]);
      
    if (error) throw error;
    
    res.status(200).json({ success: true, message: "Settings saved successfully" });
  } catch (error) {
    console.error("Error in updateConfig:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cookie_consents")
      .select("status, categories, country_code, page_slug, created_at");
      
    if (error) throw error;
    
    // Aggregate stats in memory (lean DB structure strategy)
    let total = 0;
    let acceptedAll = 0;
    let rejectedAll = 0;
    let customized = 0;
    
    data.forEach(c => {
      total++;
      if (c.categories === 15) acceptedAll++; // Assuming 1+2+4+8 = 15
      else if (c.categories === 1) rejectedAll++;
      else customized++;
    });

    res.status(200).json({
      success: true,
      data: {
        total, acceptedAll, rejectedAll, customized,
        raw: data // For advanced charting on frontend
      }
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConsentLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from("cookie_consents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, end);
      
    if (error) throw error;
    
    res.status(200).json({ success: true, data, count });
  } catch (error) {
    console.error("Error in getConsentLogs:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConsentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: consent, error } = await supabase
      .from("cookie_consents")
      .select("*")
      .eq("consent_id", id)
      .single();
      
    if (error) throw error;
    
    const { data: audit_logs, error: auditError } = await supabase
      .from("cookie_audit_logs")
      .select("*")
      .eq("consent_id", consent.id)
      .order("changed_at", { ascending: true });
      
    if (auditError) throw auditError;
    
    res.status(200).json({ success: true, data: { ...consent, audit_logs } });
  } catch (error) {
    console.error("Error in getConsentDetails:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportLogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cookie_consents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000); // Limit for safety
      
    if (error) throw error;
    
    // Assuming CSV export for simplicity, extensible to JSON/PDF
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cookie_consents.csv"');
    
    const headers = "consent_id,visitor_id,status,categories,country_code,device_type,created_at\\n";
    const rows = data.map(r => `${r.consent_id},${r.visitor_id},${r.status},${r.categories},${r.country_code},${r.device_type},${r.created_at}`).join("\\n");
    
    res.status(200).send(headers + rows);
  } catch (error) {
    console.error("Error in exportLogs:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
