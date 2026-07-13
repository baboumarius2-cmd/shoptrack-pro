import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("livreurs").select("*").eq("actif", true).order("principal",{ascending:false}).order("nom");
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { action, requesterRole, livreur, id } = req.body;
    if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });

    if (action === "add") {
      if (!livreur?.nom) return res.status(400).json({ error:"Le nom du livreur est requis" });
      const { error } = await supabase.from("livreurs").insert({
        nom: livreur.nom, ville: livreur.ville||"", phone: (livreur.phone||"").replace(/\D/g,""),
        principal: !!livreur.principal, actif: true,
      });
      if (error) return res.status(500).json({ error:error.message });
      // Un seul livreur principal à la fois
      if (livreur.principal) {
        const { data: added } = await supabase.from("livreurs").select("id").eq("nom", livreur.nom).order("id",{ascending:false}).limit(1).single();
        if (added) await supabase.from("livreurs").update({ principal:false }).neq("id", added.id);
      }
      return res.status(200).json({ success:true });
    }
    if (action === "update") {
      if (!id) return res.status(400).json({ error:"Livreur manquant" });
      const u = {};
      if (livreur.nom!==undefined) u.nom = livreur.nom;
      if (livreur.ville!==undefined) u.ville = livreur.ville;
      if (livreur.phone!==undefined) u.phone = (livreur.phone||"").replace(/\D/g,"");
      if (livreur.principal!==undefined) u.principal = !!livreur.principal;
      const { error } = await supabase.from("livreurs").update(u).eq("id", id);
      if (error) return res.status(500).json({ error:error.message });
      if (livreur.principal===true) await supabase.from("livreurs").update({ principal:false }).neq("id", id);
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      if (!id) return res.status(400).json({ error:"Livreur manquant" });
      const { error } = await supabase.from("livreurs").update({ actif:false }).eq("id", id);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    return res.status(400).json({ error:"Action inconnue" });
  }
  return res.status(405).json({ error:"Method not allowed" });
}
