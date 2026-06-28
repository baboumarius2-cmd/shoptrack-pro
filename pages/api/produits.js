import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("produits").select("*").order("created_at",{ascending:false});
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }
  if (req.method === "POST") {
    const { action, produit } = req.body;
    if (action === "add") {
      const { error } = await supabase.from("produits").insert({
        nom:produit.nom, emoji:produit.emoji||"📦", categorie:produit.categorie||"Général",
        stock_initial:+produit.stockInitial||0, stock_actuel:+produit.stockInitial||0,
        cout_achat:+produit.coutAchat||0, cout_fret:+produit.coutFret||0,
        prix_vente:+produit.prixVente||0, conditionnement:produit.conditionnement||"",
        seuil_alerte:+produit.seuilAlerte||10, image:produit.image||null,
      });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "update") {
      const { id, updates } = req.body;
      const { error } = await supabase.from("produits").update(updates).eq("id", id);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "decrement") {
      const { id, qte } = req.body;
      const { data } = await supabase.from("produits").select("stock_actuel").eq("id", id).single();
      if (data) {
        await supabase.from("produits").update({ stock_actuel:Math.max(0,data.stock_actuel-qte) }).eq("id", id);
      }
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      const { id } = req.body;
      await supabase.from("produits").delete().eq("id", id);
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
