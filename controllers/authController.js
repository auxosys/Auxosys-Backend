const supabase = require("../config/supabaseClient");
const { signCustomToken, verifyToken } = require("../utils/jwtHelper");

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Create a temporary client to avoid mutating the global backend singleton
    const { createClient } = require("@supabase/supabase-js");
    const tempSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    const { data, error } = await tempSupabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // We send back a custom extended JWT (30 days) for the Admin panel to prevent quick logouts
    const customToken = signCustomToken(data.user);
    res.status(200).json({ success: true, token: customToken, user: data.user });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Note: We would ideally use supabase.auth.signOut(), but it requires a session.
      // Since it's JWT, the client handles removing the token anyway.
      // We'll just return a success response to keep the API clean.
    }
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /profile/me
exports.getProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(' ')[1];

    const decoded = await verifyToken(token);
    const userId = decoded.id || decoded._id || decoded.user_metadata?.id;

    let user = decoded;
    if (userId) {
      const { data: fetchRes } = await supabase.auth.admin.getUserById(userId);
      if (fetchRes?.user) {
        user = fetchRes.user;
      }
    }

    if (user.email === "auxosys@gmail.com" || user.email === "admin@auxosys.com") {
      return res.status(200).json({
        success: true,
        data: {
          admin: {
            id: user.id,
            email: user.email,
            role: "Superadmin",
            permissions: ["dashboard", "careers", "newsroom", "seo", "contact", "subscriptions", "legal", "access-control", "outreach", "offer_letters", "client_management"]
          }
        }
      });
    }

    const permissions = user.user_metadata?.permissions || [];
    
    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: user.id,
          email: user.email,
          firstName: user.user_metadata?.firstName,
          lastName: user.user_metadata?.lastName,
          role: "admin",
          permissions: permissions
        }
      }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};
