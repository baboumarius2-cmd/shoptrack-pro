import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("orders").select("*");
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }
  if (req.method === "POST") {
    const { action } = req.body;
    if (action === "update") {
      const { shopifyId, updates } = req.body;
      const { error } = await supabase.from("orders").upsert({ shopify_id:shopifyId, ...updates }, { onConflict:"shopify_id" });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "add_manual") {
      const { order } = req.body;
      const { error } = await supabase.from("orders").insert(order);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    // Réinitialisation de l'historique des statuts (bilan + page livreur repartent à zéro).
    // Les commandes Shopify elles-mêmes restent : elles reviennent de Shopify en statut "en attente".
    if (action === "reset_all") {
      if (req.body.requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      const { error } = await supabase.from("orders").delete().gte("id", 0);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
