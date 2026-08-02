const supabase = require("../config/supabaseClient");

exports.getAllPages = async (req, res) => {
  try {
    const { data, error } = await supabase.from("pages").select("id, slug, title, type, status, updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPageBySlug = async (req, res) => {
  try {
    const { data, error } = await supabase.from("pages").select("*").eq("slug", req.params.slug).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Page not found" });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPage = async (req, res) => {
  try {
    const { data, error } = await supabase.from("pages").insert([req.body]).select();
    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { data, error } = await supabase.from("pages").update(req.body).eq("id", req.params.id).select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { error } = await supabase.from("pages").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Page deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
