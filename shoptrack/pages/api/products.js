export default async function handler(req, res) {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;

  if (!store || !token) {
    return res.status(400).json({ error: "Shopify non configuré" });
  }

  try {
    const response = await fetch(
      `https://${store}/admin/api/2024-04/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) throw new Error(`Erreur Shopify: ${response.status}`);

    const data = await response.json();

    const products = data.products.map((p) => ({
      id: String(p.id),
      nom: p.title,
      emoji: "📦",
      categorie: p.product_type || "Général",
      prixVente: parseFloat(p.variants[0]?.price || 0),
      prixAchat: 0,
      stockActuel: p.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
      stockInit: p.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
      image: p.image?.src || null,
    }));

    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
