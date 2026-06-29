import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("clients").select("*").order("derniere_commande",{ascending:false});
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { action } = req.body;

    // Synchroniser un client depuis une commande (créé ou mis à jour)
    if (action === "sync") {
      const { client } = req.body;
      if (!client?.phone) return res.status(400).json({ error:"Téléphone requis" });
      const phone = client.phone.replace(/\D/g,"");
      if (!phone) return res.status(400).json({ error:"Téléphone invalide" });

      const { data: existing } = await supabase.from("clients").select("*").eq("phone", phone).single();
      if (existing) {
        // fusionner produits et catégories sans doublon
        const prods = new Set((existing.produits||"").split("|").filter(Boolean));
        if (client.produit) prods.add(client.produit);
        const cats = new Set((existing.categories||"").split("|").filter(Boolean));
        if (client.categorie) cats.add(client.categorie);
        await supabase.from("clients").update({
          nom: client.nom||existing.nom,
          produits: [...prods].join("|"),
          categories: [...cats].join("|"),
          commune: client.commune||existing.commune,
          nb_commandes: (existing.nb_commandes||1)+1,
          total_depense: (existing.total_depense||0)+(client.prix||0),
          derniere_commande: client.date||existing.derniere_commande,
          derniere_boutique: client.boutiqueNom||existing.derniere_boutique,
          updated_at: new Date().toISOString(),
        }).eq("phone", phone);
      } else {
        await supabase.from("clients").insert({
          nom: client.nom||"Client", phone,
          produits: client.produit||"", categories: client.categorie||"",
          commune: client.commune||"", nb_commandes:1, total_depense: client.prix||0,
          derniere_commande: client.date||null, derniere_boutique: client.boutiqueNom||"",
        });
      }
      return res.status(200).json({ success:true });
    }

    if (action === "update") {
      const { id, updates } = req.body;
      await supabase.from("clients").update(updates).eq("id", id);
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      const { id } = req.body;
      await supabase.from("clients").delete().eq("id", id);
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
