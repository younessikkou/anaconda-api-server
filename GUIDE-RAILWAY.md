# ========================================
# 🚂 GUIDE COMPLET - DÉPLOIEMENT RAILWAY
# ========================================

## ✅ ÉTAPE 1 : Créer un compte Railway

1. Allez sur https://railway.app
2. Cliquez sur **"Login"** ou **"Start a New Project"**
3. Connectez-vous avec **GitHub** (recommandé) ou **Email**
4. ✅ Vous avez **$5 de crédit gratuit** chaque mois (largement suffisant)

---

## ✅ ÉTAPE 2 : Préparer le dépôt GitHub

### Option A : Avec GitHub (Recommandé)

1. Créez un nouveau repository sur GitHub (public ou privé)
   - Nom : `anaconda-api-server`
   
2. Initialisez Git dans le dossier :
```bash
cd ANACONDA-API-SERVER
git init
git add .
git commit -m "Initial commit - ANACONDA API Server"
```

3. Connectez au repo GitHub :
```bash
git remote add origin https://github.com/VOTRE_USERNAME/anaconda-api-server.git
git push -u origin main
```

### Option B : Sans GitHub (CLI Railway)

1. Installez Railway CLI :
```bash
npm install -g @railway/cli
```

2. Connectez-vous :
```bash
railway login
```

3. Déployez directement :
```bash
cd ANACONDA-API-SERVER
railway init
railway up
```

---

## ✅ ÉTAPE 3 : Déployer sur Railway

### Méthode GitHub (Plus simple)

1. Sur https://railway.app, cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Choisissez votre repo `anaconda-api-server`
4. Railway détectera automatiquement Node.js et déploiera !

---

## ✅ ÉTAPE 4 : Configurer les variables d'environnement

1. Dans Railway, cliquez sur votre projet
2. Allez dans l'onglet **"Variables"**
3. Ajoutez ces variables :

```
JSONBIN_MASTER_KEY = $2a$10$..I/zc0QW.o88TLtT7A40.zkUqEvhRRuGwGNGbHC/FUNSQVKyxBOK
LICENSES_BIN_ID = 693450a0d0ea881f4016f644
COUNTRIES_BIN_ID = 6936dfeed0ea881f401adb0a
DYNAMIC_BIN_ID = 693acce6d0ea881f40220920
```

4. Railway redémarrera automatiquement avec les nouvelles variables

---

## ✅ ÉTAPE 5 : Obtenir l'URL publique

1. Dans Railway, allez dans **"Settings"**
2. Cliquez sur **"Generate Domain"**
3. Vous recevrez une URL comme :
   ```
   https://anaconda-api-production.up.railway.app
   ```

4. ✅ Notez cette URL - vous en aurez besoin pour modifier l'extension

---

## ✅ ÉTAPE 6 : Tester votre API

Testez avec PowerShell :

```powershell
# Health check
Invoke-WebRequest -Uri "https://VOTRE-URL.railway.app/health" -UseBasicParsing

# Test vérification licence
$body = @{
    licenseKey = "ANACONDA-2025-USER-0001"
    hwid = "TEST-HWID-12345"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://VOTRE-URL.railway.app/api/verify-license" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## ✅ ÉTAPE 7 : Modifier l'extension Chrome

Une fois l'API déployée, je modifierai l'extension pour qu'elle utilise votre URL Railway au lieu de JSONBin direct.

---

## 💰 COÛTS Railway

- ✅ **$5 gratuit/mois** (suffit pour ~500,000 requêtes)
- ✅ Après ça : ~$0.000463 par GB-heure
- ✅ Pour votre usage : **Largement gratuit**

---

## 🔒 SÉCURITÉ

- ✅ Les clés JSONBin restent sur Railway (jamais dans l'extension)
- ✅ Les clients ne peuvent QUE lire leurs propres licences
- ✅ Aucune modification possible sans accès au serveur Railway
- ✅ Vous gardez le contrôle total

---

## 🆘 BESOIN D'AIDE ?

- Railway Docs : https://docs.railway.app
- Railway Discord : https://discord.gg/railway
- Mon support : Dites-moi si vous avez besoin d'aide !
