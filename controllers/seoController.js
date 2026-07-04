const supabase = require("../config/supabaseClient");
const path = require("path");

exports.getGlobalSeo = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("seo")
      .select("*")
      .eq("page", "global")
      .single();
    
    if (error && error.code !== "PGRST116") throw error; // ignore no rows error
    res.status(200).json({ success: true, data: data || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGlobalSeo = async (req, res) => {
  try {
    const { title, description, keywords, author, openGraph, twitter, metaTags } = req.body;
    // Admin frontend passes a complex object, we'll store basic fields and dump the rest into a jsonb or just store basic
    const payload = {
        title,
        description,
        keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords,
    };

    const { data, error } = await supabase
      .from("seo")
      .upsert({ page: "global", ...payload }, { onConflict: "page" })
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadOgImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No image provided" });
  const url = `/uploads/${req.file.filename}`;
  res.status(200).json({ success: true, data: { url, key: req.file.filename } });
};

exports.uploadOrgLogo = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No logo provided" });
  const url = `/uploads/${req.file.filename}`;
  res.status(200).json({ success: true, data: { url, key: req.file.filename } });
};
