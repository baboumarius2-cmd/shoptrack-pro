-- ════════════════════════════════════════
-- YAH-NI STORE — Table CLIENTS (base par catégorie)
-- À coller dans Supabase > SQL Editor > Run (Exécuter sans RLS)
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  phone TEXT NOT NULL,
  produits TEXT DEFAULT '',
  categories TEXT DEFAULT '',
  commune TEXT DEFAULT '',
  nb_commandes INTEGER DEFAULT 1,
  total_depense NUMERIC DEFAULT 0,
  derniere_commande DATE,
  derniere_boutique TEXT DEFAULT '',
  opt_in BOOLEAN DEFAULT FALSE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone)
);

ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients(phone);
