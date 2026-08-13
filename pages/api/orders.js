import { getSupabase } from "../../lib/supabase";
import { sendPushToType } from "../../lib/push";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    // Supabase renvoie au maximum 1000 lignes par requête. Au-delà, les commandes
    // récentes seraient invisibles (statuts d'appel, transferts qui "disparaissent").
    // On récupère donc les données par tranches, en commençant par les plus récentes.
    const TRANCHE = 1000;
    const MAX_TRANCHES = 12; // sécurité : jusqu'à 12 000 commandes
    let toutes = [];
    for (let i = 0; i < MAX_TRANCHES; i++) {
      const { data, error } = await supabase
        .from("orders").select("*")
        .order("date", { ascending: false })
        .range(i * TRANCHE, (i + 1) * TRANCHE - 1);
      if (error) return res.status(500).json({ error: error.message });
      toutes = toutes.concat(data || []);
      if (!data || data.length < TRANCHE) break;
    }
    return res.status(200).json(toutes);
  }
  if (req.method === "POST") {
    const { action } = req.body;
    if (action === "update") {
      const { shopifyId, updates } = req.body;
      // On cherche d'abord la ligne, puis on met à jour OU on insère.
      // (Plus fiable que upsert/onConflict, qui exige une contrainte d'unicité sur shopify_id.)
      const { data: existante, error: errLecture } = await supabase
        .from("orders").select("id, transferred").eq("shopify_id", shopifyId).maybeSingle();
      if (errLecture) return res.status(500).json({ error: errLecture.message });

      const nouveauTransfert = updates.transferred === true && !existante?.transferred;

      let error;
      if (existante) {
        ({ error } = await supabase.from("orders").update(updates).eq("shopify_id", shopifyId));
      } else {
        ({ error } = await supabase.from("orders").insert({ shopify_id: shopifyId, ...updates }));
      }
      if (error) return res.status(500).json({ error: error.message });

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
