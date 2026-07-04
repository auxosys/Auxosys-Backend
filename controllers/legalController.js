const supabase = require("../config/supabaseClient");

exports.getAllLegalPages = async (req, res) => {
  try {
    const { data, error } = await supabase.from("legal_pages").select("*").order("order_index", { ascending: true });
    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPage = async (req, res) => {
  try {
    const { title, slug, content, published } = req.body;
    const { data, error } = await supabase
      .from("legal_pages")
      .insert([{ title, slug, content, published }])
      .select();
    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { title, slug, content, published } = req.body;
    const { data, error } = await supabase
      .from("legal_pages")
      .update({ title, slug, content, published, last_updated: new Date() })
      .eq("id", req.params.id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { data, error } = await supabase.from("legal_pages").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reorderPages = async (req, res) => {
  try {
    const { pages } = req.body; // array of { _id, orderIndex }
    
    // update each page concurrently
    await Promise.all(
      pages.map(p => 
        supabase
          .from("legal_pages")
          .update({ order_index: p.orderIndex })
          .eq("id", p._id || p.id)
      )
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
