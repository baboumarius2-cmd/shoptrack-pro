import { getSupabase, getSettings } from "../../lib/supabase";
import { sendPushToType } from "../../lib/push";

/**
 * Vérificateur de nouvelles commandes — appelé toutes les X minutes par un service
 * externe (ex: cron-job.org) avec l'URL : /api/push-check?key=CRON_SECRET
 * - Détecte les nouvelles commandes Shopify (toutes boutiques)
 * - Envoie une notification push aux appareils abonnés "commandes" (Assistante, Patron)
 * - Ne notifie JAMAIS deux fois la même commande (table orders_vues)
 */
export default async function handler(req, res) {
  if ((req.query.key || "") !== (process.env.CRON_SECRET || "___")) {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase non configuré" });

  try {
    // 1. Boutiques (même logique que /api/shopify)
    let boutiques = [];
    const { data } = await supabase.from("boutiques").select("*").eq("active", true);
    boutiques = data || [];
    if (boutiques.length === 0) {
      let store = process.env.SHOPIFY_STORE, token = process.env.SHOPIFY_TOKEN;
      if ((!store || !token)) {
        const s = await getSettings(supabase, ["shopify_store", "shopify_token"]);
        store = store || s.shopify_store; token = token || s.shopify_token;
      }
      if (store && token) boutiques = [{ id: "default", nom: "Yah-ni Store", domaine: store, token }];
    }
    if (boutiques.length === 0) return res.status(200).json({ ok: true, note: "Aucune boutique" });

    // 2. Commandes des 6 dernières heures (large, la déduplication fait le reste)
    const start = new Date(Date.now() - 6 * 3600 * 1000);
    const results = await Promise.allSettled(boutiques.map(async (b) => {
      const r = await fetch(`https://${b.domaine}/admin/api/2024-04/orders.json?status=any&created_at_min=${start.toISOString()}&limit=100&fields=id,order_number,created_at,total_price,shipping_address,billing_address,line_items,email,phone`,
        { headers: { "X-Shopify-Access-Token": b.token, "Content-Type": "application/json" } });
      if (!r.ok) throw new Error(`${b.nom}: ${r.status}`);
      const d = await r.json();
      return (d.orders || []).map(o => {
        const a = o.shipping_address || o.billing_address || {};
        return {
          shopifyId: `${b.id}_${o.id}`,
          numero: `#${o.order_number}`,
          client: `${a.first_name || ""} ${a.last_name || ""}`.trim() || o.email || "Client",
          commune: a.city || "",
          prix: parseFloat(o.total_price || 0),
        };
      });
    }));
    let recents = [];
    results.forEach(r => { if (r.status === "fulfilled") recents = recents.concat(r.value); });
    if (recents.length === 0) return res.status(200).json({ ok: true, nouvelles: 0 });

    // 3. Déduplication : lesquelles sont vraiment nouvelles ?
    const ids = recents.map(o => o.shopifyId);
    const { data: vues } = await supabase.from("orders_vues").select("shopify_id").in("shopify_id", ids);
    const vuSet = new Set((vues || []).map(v => v.shopify_id));
    const nouvelles = recents.filter(o => !vuSet.has(o.shopifyId));
    if (nouvelles.length === 0) return res.status(200).json({ ok: true, nouvelles: 0 });

    // 4. Marquer comme vues
    await supabase.from("orders_vues").upsert(nouvelles.map(o => ({ shopify_id: o.shopifyId })), { onConflict: "shopify_id" });

    // 5. Premier lancement : on enregistre tout sans notifier (évite une rafale de vieilles commandes)
    const { count } = await supabase.from("orders_vues").select("*", { count: "exact", head: true });
    if ((count || 0) <= nouvelles.length) {
      return res.status(200).json({ ok: true, init: true, enregistrees: nouvelles.length });
    }

    // 6. Notification
    let payload;
    if (nouvelles.length === 1) {
      const o = nouvelles[0];
      payload = { title: "🛒 Nouvelle commande !", body: `${o.numero} · ${o.client}${o.commune ? " · " + o.commune : ""} · ${Math.round(o.prix).toLocaleString("fr-FR")} F`, tag: "nouvelle-commande", url: "/" };
    } else {
      payload = { title: `🛒 ${nouvelles.length} nouvelles commandes !`, body: nouvelles.map(o => `${o.numero} ${o.client}`).slice(0, 3).join(" · ") + (nouvelles.length > 3 ? "…" : ""), tag: "nouvelle-commande", url: "/" };
    }
    const { sent } = await sendPushToType(supabase, "commandes", payload);
    return res.status(200).json({ ok: true, nouvelles: nouvelles.length, notifications: sent });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
