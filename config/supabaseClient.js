require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file");
}

const supabase = createClient(supabaseUrl || "http://placeholder.url", supabaseKey || "placeholder-key");

/**
 * Executes a Supabase promise with a timeout fallback (default 3 seconds) to prevent backend requests
 * from hanging or returning 500 errors when Supabase is experiencing Cloudflare 522 connection timeouts.
 */
supabase.safeQuery = async (promise, fallbackData = [], timeoutMs = 3000) => {
  try {
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: fallbackData, count: Array.isArray(fallbackData) ? fallbackData.length : 0, error: null, isTimeout: true }), timeoutMs)
    );
    const res = await Promise.race([promise, timeoutPromise]);
    if (res?.error && !res.isTimeout) {
      console.warn("Supabase query warning:", res.error.message || res.error);
      return { data: fallbackData, count: Array.isArray(fallbackData) ? fallbackData.length : 0, error: res.error };
    }
    return res;
  } catch (err) {
    console.warn("Supabase query exception:", err.message);
    return { data: fallbackData, count: Array.isArray(fallbackData) ? fallbackData.length : 0, error: err };
  }
};

module.exports = supabase;
