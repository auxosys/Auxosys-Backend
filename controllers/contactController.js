const supabase = require("../config/supabaseClient");

exports.getAllMessages = async (req, res) => {
  try {
    let query = supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    
    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .update({ status: req.body.status })
      .eq("id", req.params.id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStar = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .update({ is_starred: req.body.isStarred })
      .eq("id", req.params.id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
