import webpush from "web-push";

export function getWebpush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  webpush.setVapidDetails("mailto:contact@yahni.store", pub, priv);
  return webpush;
}

/**
 * Envoie une notification à tous les appareils abonnés d'un type donné.
 * type = 'commandes' (Patron/Assistante) ou 'livraisons' (Livreur principal)
 */
export async function sendPushToType(supabase, type, payload) {
  const wp = getWebpush();
  if (!wp || !supabase) return { sent: 0 };
  const { data } = await supabase.from("push_subscriptions").select("*").eq("notif_type", type);
  let sent = 0;
  for (const sub of data || []) {
    try {
      await wp.sendNotification(sub.subscription, JSON.stringify(payload));
      sent++;
    } catch (e) {
      // Abonnement expiré ou révoqué → on le nettoie
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return { sent };
}
