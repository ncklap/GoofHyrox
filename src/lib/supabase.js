import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Accept full URL or project ref only (e.g. abcxyz → https://abcxyz.supabase.co)
const supabaseUrl =
  rawUrl && !rawUrl.startsWith('http')
    ? `https://${rawUrl.replace(/\.supabase\.co\/?$/, '')}.supabase.co`
    : rawUrl;

if (!supabaseUrl || !supabaseAnonKey) {
  const hasUrl = Boolean(supabaseUrl);
  const hasKey = Boolean(supabaseAnonKey);
  const rawUrlLen = (rawUrl || '').length;
  const anonKeyLen = (supabaseAnonKey || '').length;

  // Fail fast so deployed builds clearly show the env injection issue.
  throw new Error(
    [
      'Supabase env vars missing for this build.',
      `VITE_SUPABASE_URL present: ${hasUrl} (rawUrl length: ${rawUrlLen})`,
      `VITE_SUPABASE_ANON_KEY present: ${hasKey} (anonKey length: ${anonKeyLen})`,
      'Ensure these are set in Vercel for Production and redeploy.'
    ].join(' ')
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
