const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL manquant dans .env');
if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY manquant dans .env');

// Client admin avec service key (bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = { supabase };
