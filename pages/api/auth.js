import { getSupabase } from "../../lib/supabase";
import bcrypt from "bcryptjs";

const KEYS = { patron:"patron_password", assistante:"assistante_password", livreur:"livreur_password" };
const PIN_RE = /^\d{4,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  const { action, role, password, newPassword, requesterRole } = req.body;
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Base de données non configurée. Ajoutez les clés Supabase dans Vercel." });

  const key = KEYS[role];
  if (!key) return res.status(400).json({ error:"Rôle invalide" });

  try {
    if (action === "login") {
      const { data } = await supabase.from("settings").select("value").eq("key", key).single();
      if (!data?.value) return res.status(404).json({ error:"no_password" });
      const ok = await bcrypt.compare(password, data.value);
      if (!ok) return res.status(401).json({ error:"Code incorrect" });
      return res.status(200).json({ success:true, role });
    }
    if (action === "setup") {
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const { data: existing } = await supabase.from("settings").select("value").eq("key", key).single();
      if (existing?.value) return res.status(400).json({ error:"Code déjà créé" });
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("settings").upsert({ key, value: hash });
      return res.status(200).json({ success:true });
    }
    if (action === "change") {
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const { data } = await supabase.from("settings").select("value").eq("key", key).single();
      if (data?.value) {
        const ok = await bcrypt.compare(password, data.value);
        if (!ok) return res.status(401).json({ error:"Ancien code incorrect" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("settings").upsert({ key, value: hash });
      return res.status(200).json({ success:true });
    }
    // Le Patron réinitialise directement le code d'un autre rôle (sans connaître l'ancien)
    if (action === "admin_set") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("settings").upsert({ key, value: hash });
      return res.status(200).json({ success:true });
    }
    // Le Patron bloque l'accès d'un rôle (supprime le code, la personne devra en recréer un que le Patron lui communiquera)
    if (action === "admin_block") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      await supabase.from("settings").delete().eq("key", key);
      return res.status(200).json({ success:true });
    }
  } catch (e) { return res.status(500).json({ error:e.message }); }
  return res.status(400).json({ error:"Action inconnue" });
}
