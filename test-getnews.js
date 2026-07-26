require("dotenv").config();
const supabase = require("./config/supabaseClient");
(async () => {
  const { data: post, error } = await supabase
    .from("news")
    .select("*")
    .eq("id", "3323882a-38f3-4e2a-82d1-d29977260bce")
    .single();
  console.log(post);
})();
