import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("boutiques").select("*").order("created_at",{ascending:true});
    if (error) return res.status(500).json({ error:error.message });
    // Ne pas renvoyer les tokens au frontend (sécurité)
    const safe = (data||[]).map(b => ({ id:b.id, nom:b.nom, domaine:b.domaine, couleur:b.couleur, active:b.active, hasToken:!!b.token }));
    return res.status(200).json(safe);
  }

  if (req.method === "POST") {
    const { action, boutique } = req.body;
    if (action === "add") {
      if (!boutique.nom || !boutique.domaine || !boutique.token) return res.status(400).json({ error:"Nom, domaine et token requis" });
      const { error } = await supabase.from("boutiques").insert({
        nom:boutique.nom, domaine:boutique.domaine.replace(/^https?:\/\//,"").replace(/\/$/,""),
        token:boutique.token, couleur:boutique.couleur||"#E5B567", active:true,
      });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "update") {
      const { id, updates } = req.body;
      const clean = {...updates};
      if (clean.domaine) clean.domaine = clean.domaine.replace(/^https?:\/\//,"").replace(/\/$/,"");
      if (clean.token === "") delete clean.token; // ne pas écraser si vide
      const { error } = await supabase.from("boutiques").update(clean).eq("id", id);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      const { id } = req.body;
      await supabase.from("boutiques").delete().eq("id", id);
      return res.status(200).json({ success:true });
    }
    if (action === "toggle") {
      const { id, active } = req.body;
      await supabase.from("boutiques").update({ active }).eq("id", id);
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
