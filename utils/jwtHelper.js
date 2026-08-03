const jwt = require("jsonwebtoken");
const supabase = require("../config/supabaseClient");

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "default_auxosys_secret_12345_extended_session";

exports.signCustomToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    JWT_SECRET,
    { expiresIn: "30d" } // Increased token expiration to 30 days
  );
};

exports.verifyToken = async (token) => {
  try {
    // Try verifying our custom 30-day token
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    // Fallback to validating a pure Supabase token for backward compatibility
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new Error("Invalid or expired token");
    }
    return user;
  }
};
