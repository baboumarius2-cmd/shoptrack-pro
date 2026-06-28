import { getSupabase } from "../../lib/supabase";

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Supabase non configuré" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("wishlist").select("*").order("created_at",{ascending:false});
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }
  if (req.method === "POST") {
    const { action, item } = req.body;
    if (action === "add") {
      const { error } = await supabase.from("wishlist").insert({
        nom:item.nom, image:item.image||null, lien:item.lien||"",
        prix_estime:+item.prixEstime||0, source:item.source||"", note:item.note||"",
        statut:"a_commander",
      });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }
    if (action === "update") {
      const { id, updates } = req.body;
      await supabase.from("wishlist").update(updates).eq("id", id);
      return res.status(200).json({ success:true });
    }
    if (action === "delete") {
      await supabase.from("wishlist").delete().eq("id", item.id);
      return res.status(200).json({ success:true });
    }
  }
  return res.status(405).json({ error:"Method not allowed" });
}
