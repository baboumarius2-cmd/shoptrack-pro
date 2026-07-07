-- ═══════════════════════════════════════════════════════════
-- MIGRATION : suivi "qui a livré / signalé et à quelle heure"
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

ALTER TABLE orders ADD COLUMN IF NOT EXISTS statut_par TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS statut_heure TEXT;

-- Vérification : SELECT statut_par, statut_heure FROM orders LIMIT 1;
