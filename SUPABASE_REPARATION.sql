-- ═══════════════════════════════════════════════════════════════════
--  YAH-NI STORE — RÉPARATION COMPLÈTE DE LA BASE
--  À exécuter dans Supabase → SQL Editor → New query → Run
--
--  Sans risque : n'efface AUCUNE donnée. Ajoute uniquement ce qui manque.
--  (Les lignes déjà présentes sont ignorées grâce à IF NOT EXISTS.)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Suivi des appels (qui a appelé, à quelle heure) ──
ALTER TABLE orders ADD COLUMN IF NOT EXISTS appel_heure TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS appel_par TEXT;

-- ── 2. Suivi des statuts (qui a livré / signalé, à quelle heure) ──
ALTER TABLE orders ADD COLUMN IF NOT EXISTS statut_par TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS statut_heure TEXT;

-- ── 3. Transferts au livreur ──
ALTER TABLE orders ADD COLUMN IF NOT EXISTS livreur_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS livreur_nom TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfert_heure TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfert_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS livreur_principal BOOLEAN;

-- ── 4. Table des livreurs (multi-livreurs) ──
CREATE TABLE IF NOT EXISTS livreurs (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  ville TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  principal BOOLEAN DEFAULT FALSE,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crée le livreur principal s'il n'en existe aucun
INSERT INTO livreurs (nom, ville, phone, principal)
SELECT 'Livreur Abidjan', 'Abidjan',
  COALESCE((SELECT value FROM settings WHERE key='livreur_phone'), ''),
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM livreurs WHERE principal = TRUE);

-- ── 5. Auteur des dépenses ──
ALTER TABLE depenses ADD COLUMN IF NOT EXISTS auteur TEXT;

-- ── 6. Notifications push ──
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  role_slug TEXT NOT NULL,
  notif_type TEXT DEFAULT 'commandes',
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders_vues (
  shopify_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
--  VÉRIFICATION — le résultat doit afficher 9 lignes
-- ═══════════════════════════════════════════════════════════════════
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('appel_heure','appel_par','statut_par','statut_heure',
                      'livreur_id','livreur_nom','transfert_heure','transfert_date','livreur_principal')
ORDER BY column_name;
