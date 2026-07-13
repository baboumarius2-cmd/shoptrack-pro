import { getSupabase } from "../../lib/supabase";
import { sendPushToType } from "../../lib/push";

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
      // Détection d'un NOUVEAU transfert (pour notifier le livreur principal)
      let nouveauTransfert = false;
      if (updates.transferred === true) {
        const { data: prev } = await supabase.from("orders").select("transferred").eq("shopify_id", shopifyId).maybeSingle();
        nouveauTransfert = !prev?.transferred;
      }
      const { error } = await supabase.from("orders").upsert({ shopify_id:shopifyId, ...updates }, { onConflict:"shopify_id" });
      if (error) return res.status(500).json({ error:error.message });
      // Push au livreur principal, uniquement si la commande lui est destinée
      if (nouveauTransfert) {
        try {
          const { data: principal } = await supabase.from("livreurs").select("id").eq("principal", true).eq("actif", true).maybeSingle();
          const pourPrincipal = !updates.livreur_id || (principal && String(updates.livreur_id) === String(principal.id));
          if (pourPrincipal) {
            await sendPushToType(supabase, "livraisons", {
              title: "🛵 Nouvelle livraison !",
              body: `${updates.client || "Commande"}${updates.commune ? " · " + updates.commune : ""}${updates.prix ? " · " + Math.round(updates.prix).toLocaleString("fr-FR") + " F" : ""}`,
              tag: "nouvelle-livraison", url: "/",
            });
          }
        } catch (e) { /* le push ne doit jamais bloquer la sauvegarde */ }
      }
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
