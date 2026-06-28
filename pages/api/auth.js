import { getSupabase } from "../../lib/supabase";
import bcrypt from "bcryptjs";

const KEYS = { patron:"patron_password", assistante:"assistante_password", livreur:"livreur_password" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  const { action, role, password, newPassword } = req.body;
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Base de données non configurée. Ajoutez les clés Supabase dans Vercel." });

  const key = KEYS[role];
  if (!key) return res.status(400).json({ error:"Rôle invalide" });

  try {
    if (action === "login") {
      const { data } = await supabase.from("settings").select("value").eq("key", key).single();
      if (!data?.value) return res.status(404).json({ error:"no_password" });
      const ok = await bcrypt.compare(password, data.value);
      if (!ok) return res.status(401).json({ error:"Mot de passe incorrect" });
      return res.status(200).json({ success:true, role });
    }
    if (action === "setup") {
      if (!newPassword || newPassword.length < 4) return res.status(400).json({ error:"Minimum 4 caractères" });
      const { data: existing } = await supabase.from("settings").select("value").eq("key", key).single();
      if (existing?.value) return res.status(400).json({ error:"Mot de passe déjà créé" });
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("settings").upsert({ key, value: hash });
      return res.status(200).json({ success:true });
    }
    if (action === "change") {
      const { data } = await supabase.from("settings").select("value").eq("key", key).single();
      if (data?.value) {
        const ok = await bcrypt.compare(password, data.value);
        if (!ok) return res.status(401).json({ error:"Ancien mot de passe incorrect" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("settings").upsert({ key, value: hash });
      return res.status(200).json({ success:true });
    }
  } catch (e) { return res.status(500).json({ error:e.message }); }
  return res.status(400).json({ error:"Action inconnue" });
}
