require('dotenv').config();
const supabase = require('./config/supabaseClient');
const { generateUniqueId } = require('./utils/idGenerator');

async function run() {
  const { data: careers, error } = await supabase.from('careers').select('id, public_id');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const job of careers) {
    if (!job.public_id) {
      const newId = await generateUniqueId('AUX', 'careers');
      await supabase.from('careers').update({ public_id: newId }).eq('id', job.id);
      console.log(`Updated job ${job.id} with ID ${newId}`);
    }
  }
  console.log("Done backfilling!");
}
run();
