# ShopTrack Pro — Yah-ni

Application de gestion des commandes Shopify avec suivi des livraisons.

## Déploiement sur Vercel (gratuit)

### Étape 1 — Créer un compte Vercel
Allez sur https://vercel.com et créez un compte gratuit avec votre email.

### Étape 2 — Installer Vercel CLI
```bash
npm install -g vercel
```

### Étape 3 — Déployer
```bash
cd shoptrack
vercel --prod
```

### Étape 4 — Configurer les variables d'environnement sur Vercel
Dans le dashboard Vercel → Settings → Environment Variables, ajoutez :
- `SHOPIFY_STORE` = `yahni.myshopify.com`  
- `SHOPIFY_TOKEN` = votre token Shopify

### Étape 5 — Accéder à l'application
Vercel vous donnera une URL du type : `https://shoptrack-xxxx.vercel.app`

## Utilisation locale (test)
```bash
npm install
npm run dev
```
Ouvrez http://localhost:3000

## Fonctionnalités
- 📋 Commandes du jour depuis Shopify (auto)
- 📊 Bilan financier complet
- 📉 Suivi des dépenses
- 📦 Gestion du stock
- 💬 WhatsApp / SMS / Appels directs
- 📤 Transfert commandes au livreur
- ✍️ Ajout commandes manuelles
- ⏰ Report de commandes
- 👑 Mode Patron (accès complet)
- 👩‍💼 Mode Assistante (sans finances)
