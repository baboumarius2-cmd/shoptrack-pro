import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data } = await supabase.from("settings").select("key, value");
    const out = {};
    (data || []).forEach(r => { if (!r.key.includes("password")) out[r.key] = r.value; });
    return res.status(200).json(out);
  }
  if (req.method === "POST") {
    const updates = req.body;
    const rows = Object.entries(updates).filter(([k]) => !k.includes("password")).map(([key,value]) => ({ key, value:String(value) }));
    if (rows.length) await supabase.from("settings").upsert(rows);
    return res.status(200).json({ success:true });
  }
  return res.status(405).json({ error:"Method not allowed" });
}
