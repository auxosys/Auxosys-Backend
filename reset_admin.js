require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword() {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    const adminUser = users.find(u => u.email === 'auxosys@gmail.com' || u.email === 'ausosys@gmail.com');
    if (!adminUser) {
        console.log('Admin user not found!');
        return;
    }
    
    const newPassword = 'AdminPassword123!';
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: newPassword
    });
    
    if (updateError) throw updateError;
    console.log(`Successfully updated password for ${adminUser.email} to: ${newPassword}`);
  } catch (err) {
    console.error(err);
  }
}

resetPassword();
