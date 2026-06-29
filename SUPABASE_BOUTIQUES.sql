-- ════════════════════════════════════════
-- YAH-NI STORE — Mise à jour BOUTIQUES + dates
-- À coller dans Supabase > SQL Editor > Run (Exécuter sans RLS)
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS boutiques (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  domaine TEXT NOT NULL,
  token TEXT NOT NULL,
  couleur TEXT DEFAULT '#E5B567',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boutiques DISABLE ROW LEVEL SECURITY;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS boutique_nom TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS boutique_id TEXT DEFAULT '';
