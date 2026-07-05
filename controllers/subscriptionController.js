const supabase = require("../config/supabaseClient");

exports.createSubscription = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    // Insert into subscriptions table
    const { data, error } = await supabase
      .from("subscriptions")
      .insert([{ email, status: "Active" }])
      .select();
      
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, message: "Email is already subscribed" });
      }
      throw error;
    }
    
    res.status(201).json({ success: true, data: data[0], message: "Successfully subscribed!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
