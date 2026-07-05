const supabase = require("../config/supabaseClient");

exports.createMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Name, email, and message are required." });
    }

    const { data, error } = await supabase
      .from("contact_messages")
      .insert([{ name, email, phone, subject, message }])
      .select();
      
    if (error) {
      console.error("Supabase Insert Error:", error);
      throw error;
    }
    
    res.status(201).json({ success: true, data: data[0], message: "Message sent successfully" });
  } catch (err) {
    console.error("Catch Block Error:", err);
    res.status(500).json({ success: false, message: err.message, details: err });
  }
};

exports.getAllMessages = async (req, res) => {
  try {
    let query = supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    
    if (req.query.status) {
      query = query.eq("status", req.query.status);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Map id to _id and created_at to createdAt for admin panel frontend compatibility
    const mappedData = (data || []).map(item => ({ ...item, _id: item.id, createdAt: item.created_at }));
    
    res.status(200).json({ success: true, data: mappedData });
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
