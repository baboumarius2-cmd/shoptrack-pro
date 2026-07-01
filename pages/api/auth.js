import { getSupabase } from "../../lib/supabase";
import bcrypt from "bcryptjs";

const PIN_RE = /^\d{4,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  const { action, role, password, newPassword, requesterRole } = req.body;
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Base de données non configurée. Ajoutez les clés Supabase dans Vercel." });
  if (!role) return res.status(400).json({ error:"Rôle invalide" });

  try {
    if (action === "login") {
      const { data } = await supabase.from("roles").select("password_hash,actif").eq("slug", role).single();
      if (!data) return res.status(404).json({ error:"Rôle introuvable" });
      if (data.actif === false) return res.status(403).json({ error:"Accès bloqué. Contactez le Patron." });
      if (!data.password_hash) return res.status(404).json({ error:"no_password" });
      const ok = await bcrypt.compare(password, data.password_hash);
      if (!ok) return res.status(401).json({ error:"Code incorrect" });
      return res.status(200).json({ success:true, role });
    }
    if (action === "setup") {
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const { data: existing } = await supabase.from("roles").select("password_hash").eq("slug", role).single();
      if (existing?.password_hash) return res.status(400).json({ error:"Code déjà créé" });
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("roles").update({ password_hash: hash }).eq("slug", role);
      return res.status(200).json({ success:true });
    }
    if (action === "change") {
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const { data } = await supabase.from("roles").select("password_hash").eq("slug", role).single();
      if (data?.password_hash) {
        const ok = await bcrypt.compare(password, data.password_hash);
        if (!ok) return res.status(401).json({ error:"Ancien code incorrect" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("roles").update({ password_hash: hash }).eq("slug", role);
      return res.status(200).json({ success:true });
    }
    // Le Patron réinitialise directement le code d'un autre rôle (sans connaître l'ancien)
    if (action === "admin_set") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      if (!PIN_RE.test(newPassword||"")) return res.status(400).json({ error:"Code numérique de 4 chiffres minimum" });
      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from("roles").update({ password_hash: hash, actif: true }).eq("slug", role);
      return res.status(200).json({ success:true });
    }
    // Le Patron bloque/débloque l'accès d'un rôle
    if (action === "admin_block") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      await supabase.from("roles").update({ actif:false }).eq("slug", role);
      return res.status(200).json({ success:true });
    }
    if (action === "admin_unblock") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      await supabase.from("roles").update({ actif:true }).eq("slug", role);
      return res.status(200).json({ success:true });
    }
  } catch (e) { return res.status(500).json({ error:e.message }); }
  return res.status(400).json({ error:"Action inconnue" });
}
