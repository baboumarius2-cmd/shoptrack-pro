export default async function handler(req, res) {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;

  if (!store || !token) {
    return res.status(400).json({ error: "Shopify non configuré. Ajoutez votre boutique dans les Paramètres." });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const response = await fetch(
      `https://${store}/admin/api/2024-04/orders.json?status=any&created_at_min=${today.toISOString()}&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erreur Shopify: ${response.status}`);
    }

    const data = await response.json();

    const orders = data.orders.map((order) => {
      const addr = order.shipping_address || order.billing_address || {};
      return {
        id: `#${order.order_number}`,
        shopifyId: String(order.id),
        client: `${addr.first_name || ""} ${addr.last_name || ""}`.trim() || order.email || "Client inconnu",
        phone: (addr.phone || order.phone || "").replace(/\D/g, ""),
        email: order.email || "",
        produit: order.line_items.map((i) => `${i.name} ×${i.quantity}`).join(", "),
        prix: parseFloat(order.total_price),
        commune: addr.city || "Inconnu",
        adresse: `${addr.address1 || ""} ${addr.city || ""}`.trim(),
        livraison: 2000,
        statut: "en_attente",
        date: order.created_at.split("T")[0],
        heure: new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        contacted: [],
        transferred: false,
        note: order.note || "",
        motif: "",
        reportDate: "",
      };
    });

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
