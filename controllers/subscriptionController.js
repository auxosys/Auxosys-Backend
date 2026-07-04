const supabase = require("../config/supabaseClient");

exports.getAllSubscriptions = async (req, res) => {
  try {
    let query = supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
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
      .from("subscriptions")
      .update({ status: req.body.status })
      .eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
