const supabase = require("../config/supabaseClient");

const cleanupOldConsents = async () => {
  try {
    console.log("Starting cookie consent cleanup job...");
    
    // Fetch retention setting from database (fallback to 365 days)
    // For this script, we'll enforce the 365 days rule for anonymous visitors.
    
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    // Hard delete records older than 1 year (or move to archive if preferred)
    const { data, error } = await supabase
      .from("cookie_consents")
      .delete()
      .lt("created_at", oneYearAgo.toISOString());
      
    if (error) throw error;
    
    console.log("Cleanup job completed successfully.");
  } catch (error) {
    console.error("Error during cleanup job:", error.message);
  }
};

// If run directly
if (require.main === module) {
  cleanupOldConsents().then(() => process.exit(0));
}

module.exports = cleanupOldConsents;
