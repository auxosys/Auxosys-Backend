require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUpdate() {
  const payload = { site_description: "Test description", updated_at: new Date() };
  let result;
  if (payload.id) {
    result = await supabase.from("seo_settings").update(payload).eq("id", payload.id).select().single();
  } else {
    result = await supabase.from("seo_settings").insert([payload]).select().single();
  }
  
  if (result.error) {
    console.error("Error:", result.error);
  } else {
    console.log("Success:", result.data);
  }
}

testUpdate();
