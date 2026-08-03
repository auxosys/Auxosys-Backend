const supabase = require("../config/supabaseClient");
const crypto = require("crypto");

/**
 * Generate a unique public ID for a given table.
 * @param {string} prefix - The prefix (e.g., 'AUX', 'APP')
 * @param {string} tableName - The Supabase table name
 * @param {string} columnName - The column name to check (e.g., 'public_id')
 * @param {number} startingLength - The initial number of digits (default: 4)
 * @returns {Promise<string>} - The unique ID
 */
exports.generateUniqueId = async (prefix, tableName, columnName = 'public_id', startingLength = 4) => {
  let length = startingLength;
  let maxRetriesPerLength = 15; // Number of collisions before expanding the digit length
  let attempt = 0;

  while (true) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1; // inclusive max
    
    // Generate secure random number between min (inclusive) and max (inclusive)
    const randomNum = crypto.randomInt(min, max + 1);
    const candidateId = `${prefix}${randomNum}`;

    // Check database for collision
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName)
      .eq(columnName, candidateId)
      .single();

    if (error && error.code === 'PGRST116') {
      // PGRST116 means 0 rows returned - the ID is completely unique!
      return candidateId;
    } else if (error) {
      // Bubble up actual database connection/permission errors
      console.error("Supabase Error checking ID uniqueness:", error);
      throw error;
    }
    
    // If no error, it means a row WAS found, indicating a collision.
    attempt++;
    if (attempt >= maxRetriesPerLength) {
      // We had too many collisions at this length. Expand the digit length.
      console.log(`Exhausted attempts for length ${length}. Expanding ID length...`);
      length++;
      attempt = 0;
    }
  }
};
