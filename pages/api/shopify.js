import { getSupabase, getSettings } from "../../lib/supabase";

async function fetchBoutiqueOrders(boutique, start) {
  const { nom, domaine, token, couleur, id } = boutique;
  const r = await fetch(`https://${domaine}/admin/api/2024-04/orders.json?status=any&created_at_min=${start.toISOString()}&limit=250`,
    { headers:{ "X-Shopify-Access-Token":token, "Content-Type":"application/json" } });
  if (!r.ok) throw new Error(`${nom}: erreur ${r.status}`);
  const data = await r.json();
  return (data.orders || []).map(o => {
    const a = o.shipping_address || o.billing_address || {};
    return {
      id: `#${o.order_number}`,
      shopifyId: `${id}_${o.id}`,
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
      boutiqueNom: nom, boutiqueId: String(id), boutiqueCouleur: couleur||"#E5B567",
    };
  });
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  const { date, days } = req.query;
  const filterDate = date || new Date().toISOString().split("T")[0];
  // Fenêtre de récupération : "days" jours avant la date demandée (défaut 7 pour le flux
  // multi-jours), + 36h de marge pour couvrir tous les décalages de fuseau horaire.
  // Le tri par date exacte se fait ensuite côté client via o.date === viewDate.
  const nbDays = Math.min(parseInt(days)||7, 30);
  const start = new Date(filterDate); start.setHours(0,0,0,0); start.setTime(start.getTime() - (nbDays*24+36)*3600*1000);

  try {
    let boutiques = [];
    if (supabase) {
      const { data } = await supabase.from("boutiques").select("*").eq("active", true);
      boutiques = data || [];
    }
    if (boutiques.length === 0) {
      let store = process.env.SHOPIFY_STORE;
      let token = process.env.SHOPIFY_TOKEN;
      if ((!store || !token) && supabase) {
        const s = await getSettings(supabase, ["shopify_store","shopify_token"]);
        store = store || s.shopify_store; token = token || s.shopify_token;
      }
      if (store && token) {
        boutiques = [{ id:"default", nom:"Yah-ni Store", domaine:store, token, couleur:"#E5B567" }];
      }
    }
    if (boutiques.length === 0) {
      return res.status(400).json({ error:"Aucune boutique configurée. Ajoutez votre boutique Shopify dans l'onglet Boutiques." });
    }
    const results = await Promise.allSettled(boutiques.map(b => fetchBoutiqueOrders(b, start)));
    let orders = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") orders = orders.concat(r.value);
      else errors.push(`${boutiques[i].nom}: ${r.reason.message}`);
    });
    return res.status(200).json({ orders, total:orders.length, errors: errors.length?errors:undefined });
  } catch (e) {
    return res.status(500).json({ error:e.message });
  }
}
