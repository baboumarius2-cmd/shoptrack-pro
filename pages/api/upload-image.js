import { getSupabase } from "../../lib/supabase";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

const BUCKET = "images";

/**
 * Reçoit une image (en base64, déjà compressée par le téléphone) et la range
 * dans le stockage Supabase. Renvoie l'adresse publique de l'image.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase non configuré" });

  try {
    const { dataUrl, nom } = req.body;
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Image invalide" });
    }

    // "data:image/jpeg;base64,XXXX" → type + contenu
    const [entete, contenu] = dataUrl.split(",");
    const type = entete.match(/data:(image\/[a-zA-Z+]+);/)?.[1] || "image/jpeg";
    const ext = type.split("/")[1].replace("jpeg", "jpg");
    const buffer = Buffer.from(contenu, "base64");

    // Le dossier de stockage est créé automatiquement au premier envoi
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!(buckets || []).some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 8388608 });
    }

    const base = (nom || "image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
    const chemin = `${base}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(chemin, buffer, {
      contentType: type, upsert: false,
    });
    if (error) return res.status(500).json({ error: error.message });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
    return res.status(200).json({ success: true, url: data.publicUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
