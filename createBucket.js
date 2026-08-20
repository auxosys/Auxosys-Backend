const supabase = require('./config/supabaseClient');

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('certificates', {
    public: true
  });
  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket created successfully:', data);
  }
}

createBucket();
