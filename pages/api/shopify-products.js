import { getSupabase, getSettings } from "../../lib/supabase";

export default async function handler(req, res) {
  let store = process.env.SHOPIFY_STORE;
  let token = process.env.SHOPIFY_TOKEN;
  const supabase = getSupabase();
  if ((!store || !token) && supabase) {
    const s = await getSettings(supabase, ["shopify_store","shopify_token"]);
    store = store || s.shopify_store; token = token || s.shopify_token;
  }
  if (!store || !token) return res.status(400).json({ error:"Shopify non configuré" });

  try {
    const r = await fetch(`https://${store}/admin/api/2024-04/products.json?limit=250`,
      { headers:{ "X-Shopify-Access-Token":token } });
    if (!r.ok) throw new Error(`Erreur Shopify ${r.status}`);
    const data = await r.json();
    const products = (data.products||[]).map(p => ({
      shopifyId:String(p.id), nom:p.title, categorie:p.product_type||"Général",
      prixVente:parseFloat(p.variants?.[0]?.price||0),
      stock:p.variants?.reduce((s,v)=>s+(v.inventory_quantity||0),0)||0,
      image:p.image?.src||null,
    }));
    return res.status(200).json({ products });
  } catch (e) { return res.status(500).json({ error:e.message }); }
}
