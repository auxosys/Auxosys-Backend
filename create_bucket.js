require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupBucket() {
  const { data, error } = await supabase.storage.getBucket('applications');
  if (error && error.message === 'The resource was not found') {
    const { data: createData, error: createError } = await supabase.storage.createBucket('applications', {
      public: true,
      allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      fileSizeLimit: 10485760 // 10MB
    });
    if (createError) {
      console.error("Error creating bucket:", createError);
    } else {
      console.log("Bucket created successfully:", createData);
    }
  } else if (error) {
    console.error("Error checking bucket:", error);
  } else {
    console.log("Bucket already exists.");
  }
}

setupBucket();
