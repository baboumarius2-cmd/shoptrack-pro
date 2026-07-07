import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("depenses").select("*").order("created_at",{ascending:false});
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }
  if (req.method === "POST") {
    const { action, depense } = req.body;
    if (action === "add") {
      const { error } = await supabase.from("depenses").insert({
        libelle:depense.libelle, montant:depense.montant, categorie:depense.categorie,
        date:depense.date, note:depense.note||"",
      });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      await supabase.from("depenses").delete().eq("id", depense.id);
      return res.status(200).json({ success:true });
    }
    // Réinitialisation complète des dépenses (Patron uniquement)
    if (action === "reset_all") {
      if (req.body.requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      const { error } = await supabase.from("depenses").delete().gte("id", 0);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
