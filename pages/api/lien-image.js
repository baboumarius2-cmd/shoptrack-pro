/**
 * Tente de récupérer l'image principale d'une page produit à partir de son lien.
 * Fonctionne sur la plupart des boutiques (AliExpress, Amazon, Alibaba, Shopify...).
 * Certains sites très protégés (Pinduoduo, Taobao...) bloquent les robots :
 * dans ce cas on renvoie une erreur claire et l'utilisateur importe l'image depuis sa galerie.
 */
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Lien manquant" });

  let cible;
  try {
    cible = new URL(url);
    if (!["http:", "https:"].includes(cible.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: "Lien invalide" });
  }
  // Sécurité : on n'autorise pas les adresses internes
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(cible.hostname)) {
    return res.status(400).json({ error: "Lien non autorisé" });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(cible.toString(), {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(t);
    if (!r.ok) return res.status(200).json({ error: `Le site a refusé la demande (code ${r.status})` });

    const html = (await r.text()).slice(0, 400000);

    // On cherche l'image officielle déclarée par la page
    const motifs = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ];
    let image = null;
    for (const m of motifs) {
      const trouve = html.match(m);
      if (trouve?.[1]) { image = trouve[1]; break; }
    }
    if (!image) return res.status(200).json({ error: "Aucune image trouvée sur cette page" });

    // Adresse relative → adresse complète
    if (image.startsWith("//")) image = cible.protocol + image;
    else if (image.startsWith("/")) image = cible.origin + image;
    image = image.replace(/&amp;/g, "&");

    const titre = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";

    return res.status(200).json({ success: true, image, titre: titre.trim().slice(0, 120) });
  } catch (e) {
    const msg = e.name === "AbortError" ? "Le site met trop de temps à répondre" : "Impossible de lire cette page";
    return res.status(200).json({ error: msg });
  }
}
