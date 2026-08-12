import { getSupabase } from "../../lib/supabase";

/**
 * Diagnostic de la base : à ouvrir dans le navigateur.
 *   /api/diag?key=VOTRE_CRON_SECRET
 * Teste une vraie écriture et renvoie l'erreur exacte de Supabase.
 */
export default async function handler(req, res) {
  if ((req.query.key || "") !== (process.env.CRON_SECRET || "___")) {
    return res.status(403).json({ error: "Accès refusé — ajoutez ?key=CRON_SECRET" });
  }
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ etape: "connexion", erreur: "Supabase non configuré" });

  const rapport = {};

  // 1. Lecture
  try {
    const { data, error } = await supabase.from("orders").select("*").limit(1);
    rapport.lecture = error ? `❌ ${error.message}` : `✅ OK (${data?.length || 0} ligne lue)`;
    if (data?.[0]) rapport.colonnes_presentes = Object.keys(data[0]).sort().join(", ");
  } catch (e) { rapport.lecture = `❌ ${e.message}`; }

  // 2. Écriture avec upsert (exactement ce que fait l'application)
  const idTest = "DIAGNOSTIC_TEST_YAHNI";
  try {
    const { error } = await supabase.from("orders").upsert({
      shopify_id: idTest, numero: "#TEST", client: "Test Diagnostic", phone: "0000000000",
      produit: "Test", prix: 0, commune: "Test", adresse: "Test",
      date: new Date().toISOString().split("T")[0], heure: "00:00",
      statut: "en_attente", contacted: ["appel"], transferred: false,
      appel_heure: "12:34", appel_par: "Diagnostic",
      transfert_date: null, livreur_principal: null, livreur_id: null, livreur_nom: null,
      statut_par: null, statut_heure: null, transfert_heure: null,
      is_manual: false, quantite: 1, livreur_statut: "en_attente", was_reported: false,
    }, { onConflict: "shopify_id" });
    rapport.ecriture_upsert = error ? `❌ ${error.message}${error.hint ? " | Piste : " + error.hint : ""}` : "✅ OK";
    rapport.code_erreur = error?.code || null;
  } catch (e) { rapport.ecriture_upsert = `❌ ${e.message}`; }

  // 3. Relecture : la donnée est-elle vraiment enregistrée ?
  try {
    const { data } = await supabase.from("orders").select("contacted, appel_heure, appel_par").eq("shopify_id", idTest).maybeSingle();
    rapport.relecture = data
      ? `✅ contacted=${JSON.stringify(data.contacted)} appel_heure=${data.appel_heure} appel_par=${data.appel_par}`
      : "❌ Rien n'a été enregistré";
  } catch (e) { rapport.relecture = `❌ ${e.message}`; }

  // 4. Nettoyage
  try { await supabase.from("orders").delete().eq("shopify_id", idTest); rapport.nettoyage = "✅ ligne de test supprimée"; }
  catch (e) { rapport.nettoyage = `⚠️ ${e.message}`; }

  rapport.conclusion = rapport.ecriture_upsert?.startsWith("✅") && rapport.relecture?.startsWith("✅")
    ? "✅ La base fonctionne. Le problème vient d'ailleurs."
    : "❌ L'écriture en base échoue — voir le message d'erreur ci-dessus.";

  return res.status(200).json(rapport);
}
