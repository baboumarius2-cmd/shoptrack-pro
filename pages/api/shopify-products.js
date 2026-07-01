import { getSupabase, getSettings } from "../../lib/supabase";

async function fetchBoutiqueProducts(domaine, token, boutiqueNom) {
  const r = await fetch(`https://${domaine}/admin/api/2024-04/products.json?limit=250`,
    { headers:{ "X-Shopify-Access-Token":token } });
  if (!r.ok) throw new Error(`${boutiqueNom}: erreur ${r.status}`);
  const data = await r.json();
  return (data.products||[]).map(p => ({
    shopifyId:String(p.id), nom:p.title, categorie:p.product_type||"Général",
    prixVente:parseFloat(p.variants?.[0]?.price||0),
    stock:p.variants?.reduce((s,v)=>s+(v.inventory_quantity||0),0)||0,
    image:p.image?.src||null,
    boutiqueNom,
  }));
}

export default async function handler(req, res) {
  const supabase = getSupabase();
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
      if (store && token) boutiques = [{ nom:"Boutique", domaine:store, token }];
    }
    if (boutiques.length === 0) return res.status(400).json({ error:"Aucune boutique Shopify configurée. Ajoutez-en une dans l'onglet Boutiques." });

    const results = await Promise.allSettled(boutiques.map(b => fetchBoutiqueProducts(b.domaine, b.token, b.nom)));
    let products = [];
    const errors = [];
    results.forEach((r,i) => { if (r.status==="fulfilled") products = products.concat(r.value); else errors.push(r.reason.message); });
    return res.status(200).json({ products, errors: errors.length?errors:undefined });
  } catch (e) { return res.status(500).json({ error:e.message }); }
}
