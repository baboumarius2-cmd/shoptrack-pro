# Yah-ni Store — Application de gestion v3

Application complète : commandes Shopify, stock, comptabilité, livraisons, wishlist sourcing.
3 rôles : **Patron**, **Assistante**, **Livreur**.

## 🗄️ Étape 1 — Base de données Supabase

Votre projet Supabase "piste de magasin Yahni" existe déjà. Il faut juste **ajouter les nouvelles tables** :

1. Ouvrez Supabase → **SQL Editor**
2. Copiez tout le contenu de `SUPABASE_SETUP.sql`
3. Collez et cliquez **Run** → "Exécuter sans RLS"

Cela crée 5 tables : settings, orders, produits, depenses, wishlist.

## 🔑 Étape 2 — Variables d'environnement Vercel

Dans Vercel → votre projet → **Settings → Environment Variables** :

```
NEXT_PUBLIC_SUPABASE_URL = https://cdztthlshogokrxnhcqf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [votre clé anon]
SUPABASE_SERVICE_KEY = [votre clé service_role]
SHOPIFY_STORE = yahni.myshopify.com
SHOPIFY_TOKEN = [votre token Shopify]
```

Les clés anon et service_role sont dans Supabase → Settings → API → onglet "Clés API héritage".

## 📤 Étape 3 — Mettre le code sur GitHub

1. Extrayez ce ZIP dans `Documents/GitHub/shoptrack-pro` (remplacez les anciens fichiers)
2. GitHub Desktop → Commit → Push origin
3. Vercel redéploie automatiquement

## ✅ Utilisation

- **Patron** : tout (commandes, bilan, dépenses, stock, wishlist, paramètres)
- **Assistante** : commandes, stock (sans prix), reportées
- **Livreur** : uniquement ses livraisons avec itinéraire

Chaque rôle crée son mot de passe à la première connexion.

## 🤖 Agent WhatsApp (Phase 2)

Dans Paramètres Patron, la section "Agent WhatsApp IA" est prête. Dès que vos accès Meta Business sont validés, collez le numéro, la clé API du BSP, et la description de vos produits.

## Fonctionnalités clés

- Commandes Shopify auto classées par zone
- Livré / Non livré / **Reporter** (réapparaît au jour choisi marqué "↩️ Reporté")
- Stock avec coûts **Chine + Fret**, marge auto, décrément à chaque livraison
- Bilan : encaissé, bénéfice brut, dépenses, **résultat réel**, taux de livraison
- Wishlist sourcing (image + lien Alibaba)
- WhatsApp / Appel / Transfert livreur
- Design clair, animations, 100% responsive (mobile/tablette/ordinateur)
