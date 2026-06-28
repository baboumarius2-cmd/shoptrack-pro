-- ════════════════════════════════════════
-- YAH-NI STORE — Base de données complète
-- À coller dans Supabase > SQL Editor > Run
-- ════════════════════════════════════════

-- Paramètres (mots de passe, config livreur, Shopify, WhatsApp)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commandes (Shopify + manuelles)
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  shopify_id TEXT UNIQUE NOT NULL,
  numero TEXT,
  client TEXT,
  phone TEXT,
  produit TEXT,
  produit_id TEXT,
  quantite INTEGER DEFAULT 1,
  prix NUMERIC DEFAULT 0,
  commune TEXT DEFAULT 'Inconnu',
  adresse TEXT,
  livraison NUMERIC DEFAULT 2000,
  statut TEXT DEFAULT 'en_attente',
  date DATE,
  heure TEXT,
  contacted JSONB DEFAULT '[]',
  transferred BOOLEAN DEFAULT FALSE,
  livreur_statut TEXT DEFAULT 'en_attente',
  note TEXT DEFAULT '',
  motif TEXT DEFAULT '',
  report_date DATE,
  was_reported BOOLEAN DEFAULT FALSE,
  is_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produits (stock, coûts Chine+Fret, prix vente)
CREATE TABLE IF NOT EXISTS produits (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  emoji TEXT DEFAULT '📦',
  categorie TEXT DEFAULT 'Général',
  stock_initial INTEGER DEFAULT 0,
  stock_actuel INTEGER DEFAULT 0,
  cout_achat NUMERIC DEFAULT 0,
  cout_fret NUMERIC DEFAULT 0,
  prix_vente NUMERIC DEFAULT 0,
  conditionnement TEXT DEFAULT '',
  seuil_alerte INTEGER DEFAULT 10,
  image TEXT,
  shopify_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dépenses
CREATE TABLE IF NOT EXISTS depenses (
  id BIGSERIAL PRIMARY KEY,
  libelle TEXT NOT NULL,
  montant NUMERIC NOT NULL,
  categorie TEXT DEFAULT 'autre',
  date DATE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishlist sourcing (produits à commander plus tard)
CREATE TABLE IF NOT EXISTS wishlist (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  image TEXT,
  lien TEXT,
  prix_estime NUMERIC DEFAULT 0,
  source TEXT DEFAULT '',
  note TEXT DEFAULT '',
  statut TEXT DEFAULT 'a_commander',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Désactiver RLS
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE produits DISABLE ROW LEVEL SECURITY;
ALTER TABLE depenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist DISABLE ROW LEVEL SECURITY;

-- Index performances
CREATE INDEX IF NOT EXISTS orders_date_idx ON orders(date);
CREATE INDEX IF NOT EXISTS orders_shopify_idx ON orders(shopify_id);
CREATE INDEX IF NOT EXISTS orders_report_idx ON orders(report_date);
CREATE INDEX IF NOT EXISTS depenses_date_idx ON depenses(date);
