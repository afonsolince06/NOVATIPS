import { createClient } from '@supabase/supabase-js';

// Create a .env.local file in the project root with:
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key

export const isFreshersWeekendEdition = import.meta.env.VITE_SITE_EDITION === 'freshers-weekend';

const supabaseUrl = isFreshersWeekendEdition
  ? import.meta.env.VITE_FDS_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = isFreshersWeekendEdition
  ? import.meta.env.VITE_FDS_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase configuration for ${isFreshersWeekendEdition ? 'Freshers Weekend' : 'NOVA TIPS'}.`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});
