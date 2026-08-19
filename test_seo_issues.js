require("dotenv").config();
const supabase = require("./config/supabaseClient");

(async () => {
  console.log("Checking if seo_issues exists...");
  const { data, error } = await supabase.from("seo_issues").select("id").limit(1);
  if (error) {
    console.error("Error checking seo_issues:", error);
  } else {
    console.log("seo_issues exists:", data);
  }
  process.exit(0);
})();
