import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function getSettings(supabase, keys) {
  const q = supabase.from("settings").select("key, value");
  const { data } = keys ? await q.in("key", keys) : await q;
  const out = {};
  (data || []).forEach(r => { out[r.key] = r.value; });
  return out;
}
