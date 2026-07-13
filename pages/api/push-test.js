import { getSupabase } from "../../lib/supabase";
import { sendPushToType } from "../../lib/push";

/**
 * Test des notifications — à ouvrir dans le navigateur :
 * /api/push-test?key=CRON_SECRET          → notifie les appareils "commandes" (Patron/Assistante)
 * /api/push-test?key=CRON_SECRET&type=livraisons → notifie le livreur principal
 */
export default async function handler(req, res) {
  if ((req.query.key || "") !== (process.env.CRON_SECRET || "___")) {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase non configuré" });
  const type = req.query.type === "livraisons" ? "livraisons" : "commandes";
  const { count } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("notif_type", type);
  const { sent } = await sendPushToType(supabase, type, {
    title: "🔔 Test Yah-ni Store",
    body: "Si tu lis ceci, les notifications fonctionnent parfaitement ! ✅",
    tag: "test", url: "/",
  });
  return res.status(200).json({ ok: true, type, appareils_abonnes: count || 0, notifications_envoyees: sent });
}
