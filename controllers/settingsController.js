const supabase = require("../config/supabaseClient");
const { verifyToken } = require("../utils/jwtHelper");

exports.getSettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from("settings").select("*").single();
    
    // If not found, or if table doesn't exist, return a default mock
    if (error) {
      return res.status(200).json({
        success: true,
        data: {
          id: "default-settings",
          language: "en",
          timezone: "Asia/Kolkata",
          notifications: {
            newEnquiries: true,
            jobApplications: true,
            newSubscribers: false,
          }
        }
      });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "default-settings") {
       return res.status(200).json({ success: true, message: "Mock settings saved (DB table missing)" });
    }
    const { data, error } = await supabase.from("settings").update(req.body).eq("id", id).select();
    if (error) throw error;
    res.status(200).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);
    
    if (user && user.email === "admin@auxosys.com") {
      return res.status(403).json({ success: false, message: "Superadmin password cannot be modified." });
    }
    
    const { newPassword } = req.body;
    // We must use the user id to update since the global supabase client has no session
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    
    if (error) throw error;
    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
