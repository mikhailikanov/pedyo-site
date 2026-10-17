// Pedyo — Supabase client initialisation
// The anon key below is safe to publish: every read it can perform is limited
// by Postgres GRANTs and row-level-security policies on the project.
const SUPABASE_URL  = 'https://oywqvvwxlpkufkcgsdhn.supabase.co';
const SUPABASE_ANON = 'sb_publishable_VmU2FwxQ6gIn_5Ap2UvwQA_8LhzcOQS';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pedyo-auth'
  },
  global: { headers: { 'x-application-name': 'pedyo-web' } }
});
