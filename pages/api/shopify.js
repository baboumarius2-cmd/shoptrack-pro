import { getSupabase, getSettings } from "../../lib/supabase";

export default async function handler(req, res) {
  let store = process.env.SHOPIFY_STORE;
  let token = process.env.SHOPIFY_TOKEN;
  const supabase = getSupabase();

  if ((!store || !token) && supabase) {
    const s = await getSettings(supabase, ["shopify_store","shopify_token"]);
    store = store || s.shopify_store;
    token = token || s.shopify_token;
  }
  if (!store || !token) return res.status(400).json({ error:"Boutique Shopify non configurée dans les Paramètres." });

  try {
    const { date } = req.query;
    const filterDate = date || new Date().toISOString().split("T")[0];
    const start = new Date(filterDate); start.setHours(0,0,0,0);

    const r = await fetch(`https://${store}/admin/api/2024-04/orders.json?status=any&created_at_min=${start.toISOString()}&limit=250`,
      { headers:{ "X-Shopify-Access-Token":token, "Content-Type":"application/json" } });
    if (!r.ok) throw new Error(`Erreur Shopify ${r.status}`);
    const data = await r.json();

    const orders = (data.orders || []).map(o => {
      const a = o.shipping_address || o.billing_address || {};
      return {
        id: `#${o.order_number}`,
        shopifyId: String(o.id),
        numero: `#${o.order_number}`,
        client: `${a.first_name||""} ${a.last_name||""}`.trim() || o.email || "Client inconnu",
        phone: (a.phone||o.phone||"").replace(/\D/g,""),
        produit: o.line_items.map(i=>`${i.name} ×${i.quantity}`).join(", "),
        produitId: o.line_items[0]?.product_id ? String(o.line_items[0].product_id) : "",
        quantite: o.line_items.reduce((s,i)=>s+i.quantity,0),
        prix: parseFloat(o.total_price||0),
        commune: a.city || "Inconnu",
        adresse: `${a.address1||""} ${a.city||""}`.trim(),
        livraison: 2000,
        statut: "en_attente",
        date: o.created_at.split("T")[0],
        heure: new Date(o.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),
        contacted: [], transferred:false, livreurStatut:"en_attente",
        note:o.note||"", motif:"", reportDate:"", wasReported:false, isManual:false,
      };
    });
    return res.status(200).json({ orders, total:orders.length });
  } catch (e) { return res.status(500).json({ error:e.message }); }
}
