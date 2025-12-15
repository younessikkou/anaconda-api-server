# 🐍 ANACONDA API SERVER

Serveur API sécurisé pour l'extension ANACONDA Chrome.  
Cache les clés JSONBin côté serveur pour empêcher les modifications non autorisées.

## 🚀 Déploiement sur Railway

### Étape 1 : Créer un compte Railway
1. Allez sur https://railway.app
2. Inscrivez-vous avec GitHub (gratuit)

### Étape 2 : Créer un nouveau projet
1. Cliquez sur "New Project"
2. Sélectionnez "Deploy from GitHub repo"
3. Connectez votre repo GitHub (ou utilisez le bouton ci-dessous)

### Étape 3 : Configurer les variables d'environnement
Dans Railway, ajoutez ces variables :
```
JSONBIN_MASTER_KEY=$2a$10$..I/zc0QW.o88TLtT7A40.zkUqEvhRRuGwGNGbHC/FUNSQVKyxBOK
LICENSES_BIN_ID=693450a0d0ea881f4016f644
COUNTRIES_BIN_ID=6936dfeed0ea881f401adb0a
DYNAMIC_BIN_ID=693acce6d0ea881f40220920
```

### Étape 4 : Déployer
Railway déploiera automatiquement votre serveur !  
Vous recevrez une URL comme : `https://anaconda-api.up.railway.app`

## 🧪 Tester localement

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start
```

Accédez à : http://localhost:3000

## 📡 Endpoints API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/verify-license` | POST | Vérifier une licence + HWID |
| `/api/update-hwid` | POST | Mettre à jour le HWID |
| `/api/countries-config` | GET | Config des pays |
| `/api/dynamic-config` | GET | Config dynamique |

## 📝 Exemple d'utilisation

```javascript
// Vérifier une licence
const response = await fetch('https://votre-api.railway.app/api/verify-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        licenseKey: 'ANACONDA-2025-USER-0001',
        hwid: 'HWID-ABC12345-XYZ'
    })
});

const data = await response.json();
console.log(data.success); // true ou false
```
