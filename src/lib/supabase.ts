import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "https://egagfxwkkewnaxwzktjs.supabase.co") as string;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable__BSIH2CiMInijVkWwDlWSw_muPyM9z6") as string;

export const supabaseUrl = url;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
