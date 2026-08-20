require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS hr_company_settings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_name text,
      legal_company_name text,
      logo_url text,
      registered_address text,
      corporate_office_address text,
      city text,
      state text,
      country text,
      pin text,
      email text,
      hr_email text,
      careers_email text,
      phone text,
      website text,
      cin text,
      gstin text,
      pan text,
      tan text,
      created_at timestamp with time zone default now(),
      updated_at timestamp with time zone default now()
    );`,
    `CREATE TABLE IF NOT EXISTS offer_letter_signatories (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text,
      designation text,
      email text,
      signature_url text,
      is_active boolean default true,
      created_at timestamp with time zone default now()
    );`,
    `CREATE TABLE IF NOT EXISTS offer_letter_clauses (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      title text,
      content text,
      is_active boolean default true,
      created_at timestamp with time zone default now()
    );`
  ];

  for (const q of queries) {
    console.log("Running query...");
    // Since supabase js client doesn't have a simple raw query method by default except via RPC or REST if enabled,
    // actually it's easier to create a migration file and let the user run it, or just use postgres module.
    // Let me check if supabase-js can run raw SQL. No, it cannot easily unless we use RPC.
  }
}

runMigrations();
