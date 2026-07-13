import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase non configuré" });

  const { action, role, notifType, subscription, endpoint } = req.body;

  if (action === "subscribe") {
    if (!subscription?.endpoint) return res.status(400).json({ error: "Abonnement invalide" });
    const { error } = await supabase.from("push_subscriptions").upsert({
      role_slug: role || "inconnu",
      notif_type: notifType === "livraisons" ? "livraisons" : "commandes",
      endpoint: subscription.endpoint,
      subscription,
    }, { onConflict: "endpoint" });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === "unsubscribe") {
    if (!endpoint) return res.status(400).json({ error: "Endpoint manquant" });
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Action inconnue" });
}
