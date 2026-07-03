const supabase = require("../config/supabaseClient");

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // We send back the session token for the Admin panel to store
    res.status(200).json({ success: true, token: data.session.access_token, user: data.user });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

// GET /profile/me
exports.getProfile = async (req, res) => {
  try {
    // We are mocking this so the Admin Panel doesn't crash while we wait for Supabase keys
    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: "mock-admin",
          email: "auxosys@gmail.com",
          role: "admin",
          permissions: ["careers", "news"]
        }
      }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};
