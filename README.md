# ABONNEMENT.TN WhatsApp Bot 🤖

Bot automatique pour répondre aux clients et vendre des abonnements numériques via WhatsApp.

## ✨ Fonctionnalités

- 💬 Répond automatiquement aux messages WhatsApp
- 🛒 Guide les clients dans le processus d'achat
- 📸 Vérifie les captures d'écran de paiement avec l'IA (GPT-4 Vision)
- 📦 Livre automatiquement les comptes après vérification
- 🔥 Enregistre les ventes dans Firebase (compatible avec l'app ABONNEMENT.TN)

## 📋 Prérequis

- Node.js 18+ 
- Clé API OpenAI (avec accès GPT-4)
- WhatsApp sur téléphone pour scanner le QR code

## 🚀 Installation

1. **Installer les dépendances:**
```bash
npm install
```

2. **Configurer l'environnement:**
```bash
cp .env.example .env
```
Puis éditez `.env` et ajoutez votre clé API OpenAI.

3. **Ajouter des comptes:**
Éditez `data/accounts/capcut-1month.txt` avec vos comptes:
```
Account: email@exemple.com
Password: motdepasse123
Remark: Avant de vous connecter, mettez à jour l'app CapCut
-----------------------------------------------------
```

4. **(Optionnel) Firebase:**
- Téléchargez le fichier de service account depuis Firebase Console
- Sauvegardez-le comme `firebase-serviceAccount.json` à la racine

## ▶️ Démarrage

```bash
npm start
```

Un QR code s'affichera. Scannez-le avec WhatsApp pour connecter le bot.

## 📁 Structure

```
├── src/
│   ├── index.js              # Point d'entrée
│   ├── config/config.js      # Configuration (produits, prix, etc.)
│   ├── platforms/
│   │   └── whatsapp.handler.js
│   └── services/
│       ├── ai.service.js     # OpenAI (conversations + vérification)
│       ├── account.service.js # Gestion des comptes
│       ├── conversation.service.js # Flux de conversation
│       └── firebase.service.js
├── data/
│   ├── accounts/             # Comptes à livrer
│   └── delivered/            # Historique des livraisons
└── logs/                     # Logs du bot
```

## ⚙️ Configuration

Éditez `src/config/config.js` pour:
- Ajouter/modifier des produits
- Changer les instructions de paiement (D17, Flouci, Izi Pay)
- Modifier les heures de fonctionnement

## ⚠️ Avertissement

L'utilisation de bots non officiels peut entraîner la suspension de votre compte WhatsApp. Utilisez un numéro dédié et non votre numéro personnel.
