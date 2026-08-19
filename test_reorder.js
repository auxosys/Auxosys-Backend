require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testReorder() {
  const items = [{ id: 1, order_index: 0, parent_id: null }]; // Replace with a valid ID from the DB
  const { data, error } = await supabase
    .from("seo_navigation")
    .upsert(items, { onConflict: 'id' })
    .select();
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success:", data);
  }
}

testReorder();
