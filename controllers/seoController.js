const supabase = require("../config/supabaseClient");

const logAudit = async (req, action, section, old_value, new_value) => {
  try {
    // In a real app, you might extract admin_id from req.user
    await supabase.from("seo_audit_logs").insert([{
      action,
      section,
      old_value,
      new_value
    }]);
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};

// ---------------------------------------------------------
// GLOBAL SETTINGS
// ---------------------------------------------------------
exports.getSettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_settings").select("*").single();
    if (error && error.code !== "PGRST116") throw error;
    res.status(200).json({ success: true, data: data || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { data: oldData } = await supabase.from("seo_settings").select("*").single();
    
    // Always upsert since there is only one settings row typically.
    // If table is empty, we don't have an ID. We assume the client sends the ID if it exists.
    const payload = { ...req.body, updated_at: new Date() };
    let query = supabase.from("seo_settings");
    
    let result;
    if (payload.id) {
      result = await query.update(payload).eq("id", payload.id).select().single();
    } else {
      // Just insert if no ID (first time)
      result = await query.insert([payload]).select().single();
    }
    
    if (result.error) throw result.error;
    
    await logAudit(req, "UPDATE", "Global Settings", oldData, result.data);
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// SITEMAP SETTINGS
// ---------------------------------------------------------
exports.getSitemapSettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_sitemap_settings").select("*").single();
    if (error && error.code !== "PGRST116") throw error;
    res.status(200).json({ success: true, data: data || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSitemapSettings = async (req, res) => {
  try {
    const { data: oldData } = await supabase.from("seo_sitemap_settings").select("*").single();
    const payload = { ...req.body, last_modified: new Date() };
    
    let result;
    if (payload.id) {
      result = await supabase.from("seo_sitemap_settings").update(payload).eq("id", payload.id).select().single();
    } else {
      result = await supabase.from("seo_sitemap_settings").insert([payload]).select().single();
    }

    if (result.error) throw result.error;
    
    await logAudit(req, "UPDATE", "Sitemap Settings", oldData, result.data);
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// REDIRECTS
// ---------------------------------------------------------
exports.getRedirects = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_redirects").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to detect redirect loops recursively
const checkRedirectLoop = async (oldPath, newPath) => {
  if (oldPath === newPath) return true;
  let currentTarget = newPath;
  let visited = new Set([oldPath]);
  
  while (true) {
    const { data } = await supabase.from("seo_redirects").select("new_path").eq("old_path", currentTarget).single();
    if (!data) break; // no further redirect
    if (visited.has(data.new_path) || data.new_path === oldPath) return true; // loop detected
    visited.add(currentTarget);
    currentTarget = data.new_path;
  }
  return false;
};

exports.createRedirect = async (req, res) => {
  try {
    const { old_path, new_path } = req.body;
    if (await checkRedirectLoop(old_path, new_path)) {
      return res.status(400).json({ success: false, message: "Redirect loop detected. Cannot create this redirect." });
    }
    const { data, error } = await supabase.from("seo_redirects").insert([req.body]).select().single();
    if (error) throw error;
    await logAudit(req, "CREATE", "Redirects", null, data);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRedirect = async (req, res) => {
  try {
    const { data: oldData } = await supabase.from("seo_redirects").select("*").eq("id", req.params.id).single();
    
    // Check loop if old_path or new_path changed
    const oldPath = req.body.old_path || oldData.old_path;
    const newPath = req.body.new_path || oldData.new_path;
    
    if (await checkRedirectLoop(oldPath, newPath)) {
      return res.status(400).json({ success: false, message: "Redirect loop detected. Cannot update this redirect." });
    }

    const { data, error } = await supabase.from("seo_redirects").update(req.body).eq("id", req.params.id).select().single();
    if (error) throw error;
    await logAudit(req, "UPDATE", "Redirects", oldData, data);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRedirect = async (req, res) => {
  try {
    const { error } = await supabase.from("seo_redirects").delete().eq("id", req.params.id);
    if (error) throw error;
    await logAudit(req, "DELETE", "Redirects", { id: req.params.id }, null);
    res.status(200).json({ success: true, message: "Redirect deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// PAGE LEVEL SEO
// ---------------------------------------------------------
const normalizeSlug = (slug) => {
  if (!slug) return '/';
  let s = slug.toLowerCase().trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
};

const calculateSeoScore = (payload) => {
  let score = 0;
  if (payload.title && payload.title.length > 10) score += 20;
  if (payload.description && payload.description.length > 50) score += 20;
  if (payload.og_image) score += 15;
  if (payload.canonical) score += 10;
  if (payload.schema_type && payload.schema_type !== 'None') score += 15;
  if (payload.keywords) score += 10;
  if (payload.robots_index !== false) score += 10;
  return Math.min(100, score);
};

exports.getPages = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_pages").select("*");
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPageById = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_pages").select("*").eq("id", req.params.id).single();
    if (error && error.code !== "PGRST116") throw error;
    res.status(200).json({ success: true, data: data || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUnifiedPageSeo = async (req, res) => {
  try {
    const slug = normalizeSlug(req.query.slug);
    
    // 1. Fetch Global Settings
    const { data: globalSettings, error: err1 } = await supabase
      .from("seo_settings")
      .select("*")
      .limit(1)
      .single();

    if (err1 && err1.code !== "PGRST116") throw err1;

    // 2. Fetch Page specific Settings
    const { data: pageSettings, error: err2 } = await supabase
      .from("seo_pages")
      .select("*")
      .eq("page_slug", slug)
      .single();

    if (err2 && err2.code !== "PGRST116") throw err2;

    // Merge strategy: Page fields override global fields if they exist
    // If a page is in Draft or Archived, we don't apply it to the frontend!
    let merged = { ...globalSettings };
    
    const now = new Date();
    
    if (pageSettings && pageSettings.status === 'Published') {
      merged = { ...merged, ...pageSettings };
    } else if (pageSettings && pageSettings.status === 'Scheduled' && pageSettings.publish_at) {
      const pubDate = new Date(pageSettings.publish_at);
      if (pubDate <= now) {
        merged = { ...merged, ...pageSettings };
      }
    }
    
    // Check if expired
    if (merged.expire_at) {
      const expDate = new Date(merged.expire_at);
      if (expDate <= now) {
         // Revert to global
         merged = { ...globalSettings };
      }
    }

    res.status(200).json({ success: true, data: { seo: merged } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertPage = async (req, res) => {
  try {
    let payload = { ...req.body, updated_at: new Date() };
    payload.page_slug = normalizeSlug(payload.page_slug);
    
    // Duplicate check if creating
    if (!payload.id) {
      const { data: existing } = await supabase.from("seo_pages").select("id").eq("page_slug", payload.page_slug).single();
      if (existing) {
        return res.status(400).json({ success: false, message: "Duplicate slug detected. A configuration for this path already exists." });
      }
    }
    
    payload.seo_score = calculateSeoScore(payload);

    const { data, error } = await supabase.from("seo_pages").insert(payload).select().single();
    if (error) throw error;
    
    await logAudit(req, "CREATE", "Page SEO", null, data);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    let payload = { ...req.body, updated_at: new Date() };
    if (payload.page_slug) payload.page_slug = normalizeSlug(payload.page_slug);
    
    const id = req.params.id;
    
    // Duplicate slug check for update
    if (payload.page_slug) {
      const { data: existing } = await supabase.from("seo_pages").select("id").eq("page_slug", payload.page_slug).single();
      if (existing && existing.id !== id) {
        return res.status(400).json({ success: false, message: "Duplicate slug detected. A configuration for this path already exists." });
      }
    }

    // Get previous for history
    const { data: previous } = await supabase.from("seo_pages").select("*").eq("id", id).single();
    if (!previous) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
    
    payload.seo_score = calculateSeoScore(payload);

    const { data, error } = await supabase.from("seo_pages").update(payload).eq("id", id).select().single();
    if (error) throw error;
    
    // Insert history record
    await supabase.from("seo_page_history").insert({
      page_id: id,
      previous_data: previous,
      updated_by: req.user?.id || null
    });
    
    await logAudit(req, "UPDATE", "Page SEO", previous, data);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { error } = await supabase.from("seo_pages").delete().eq("id", req.params.id);
    if (error) throw error;
    await logAudit(req, "DELETE", "Page SEO", { id: req.params.id }, null);
    res.status(200).json({ success: true, message: "Page SEO deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// SYSTEM FILES (llms.txt, robots.txt snippets)
// ---------------------------------------------------------
// We'll store these in a single table `seo_system_files` with columns: filename (unique), content
exports.getSystemFiles = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_system_files").select("*");
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    // Graceful fallback if table doesn't exist yet
    res.status(200).json({ success: true, data: [] });
  }
};

exports.upsertSystemFile = async (req, res) => {
  try {
    const { filename, content } = req.body;
    const { data, error } = await supabase
      .from("seo_system_files")
      .upsert({ filename, content, updated_at: new Date() }, { onConflict: 'filename' })
      .select().single();
    if (error) throw error;
    await logAudit(req, "UPSERT", "System File", null, data);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------
exports.getAuditLogs = async (req, res) => {
  try {
    const { data, error } = await supabase.from("seo_audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------
// FILE UPLOADS
// ---------------------------------------------------------
exports.uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No image provided" });
  const url = `/uploads/${req.file.filename}`;
  res.status(200).json({ success: true, data: { url, key: req.file.filename } });
};
