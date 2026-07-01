import { getSupabase } from "../../lib/supabase";

const DEFAULT_PERMS = { commandes:false, relance:false, clients:false, bilan:false, depenses:false, stock:false, wishlist:false, boutiques:false, reportees:false, voir_montants:false, livreur_mode:false };

function slugify(label) {
  return (label||"")
    .toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"") || ("role_"+Date.now());
}

export default async function handler(req, res) {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error:"Base de données non configurée." });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("roles").select("id,slug,label,icon,color,permissions,is_system,actif,ordre").order("ordre",{ascending:true});
    if (error) return res.status(500).json({ error:error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { action, requesterRole, role, slug, updates } = req.body;

    if (action === "add") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      if (!role?.label) return res.status(400).json({ error:"Le nom du rôle est requis" });
      let s = slugify(role.label);
      const { data: existing } = await supabase.from("roles").select("slug").eq("slug", s);
      if (existing && existing.length>0) s = s+"_"+Date.now().toString().slice(-4);
      const { error } = await supabase.from("roles").insert({
        slug: s, label: role.label, icon: role.icon||"👤", color: role.color||"#8B5CF6",
        permissions: { ...DEFAULT_PERMS, ...(role.permissions||{}) },
        is_system: false, actif: true, ordre: role.ordre||99,
      });
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true, slug:s });
    }

    if (action === "update") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      if (!slug) return res.status(400).json({ error:"Rôle manquant" });
      const { data: existing } = await supabase.from("roles").select("is_system").eq("slug", slug).single();
      const u = {};
      if (updates.label!==undefined) u.label = updates.label;
      if (updates.icon!==undefined) u.icon = updates.icon;
      if (updates.color!==undefined) u.color = updates.color;
      if (updates.permissions!==undefined && !existing?.is_system) u.permissions = { ...DEFAULT_PERMS, ...updates.permissions };
      const { error } = await supabase.from("roles").update(u).eq("slug", slug);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }

    if (action === "delete") {
      if (requesterRole !== "patron") return res.status(403).json({ error:"Réservé au Patron" });
      if (!slug) return res.status(400).json({ error:"Rôle manquant" });
      const { data: existing } = await supabase.from("roles").select("is_system").eq("slug", slug).single();
      if (existing?.is_system) return res.status(400).json({ error:"Ce rôle est protégé et ne peut pas être supprimé" });
      const { error } = await supabase.from("roles").delete().eq("slug", slug);
      if (error) return res.status(500).json({ error:error.message });
      return res.status(200).json({ success:true });
    }

    return res.status(400).json({ error:"Action inconnue" });
  }

  return res.status(405).json({ error:"Method not allowed" });
}
