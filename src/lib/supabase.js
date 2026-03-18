import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Accept full URL or project ref only (e.g. abcxyz → https://abcxyz.supabase.co)
const supabaseUrl =
  rawUrl && !rawUrl.startsWith('http')
    ? `https://${rawUrl.replace(/\.supabase\.co\/?$/, '')}.supabase.co`
    : rawUrl;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and add your Supabase API settings.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
