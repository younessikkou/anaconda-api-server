@echo off
chcp 65001 > nul
cls
echo.
echo ========================================
echo 🚂 DÉPLOIEMENT RAILWAY - ANACONDA API
echo ========================================
echo.

REM Vérifier si Git est installé
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Git n'est pas installé !
    echo.
    echo 📥 Installez Git : https://git-scm.com/download/win
    pause
    exit /b
)

REM Vérifier si on est dans le bon dossier
if not exist "server.js" (
    echo ❌ Erreur : Ce script doit être exécuté depuis le dossier ANACONDA-API-SERVER
    pause
    exit /b
)

echo 📋 ÉTAPES À SUIVRE :
echo.
echo 1️⃣  Créez un repo GitHub (public ou privé)
echo     URL : https://github.com/new
echo     Nom suggéré : anaconda-api-server
echo.
echo 2️⃣  Copiez l'URL du repo (ex: https://github.com/VOUS/anaconda-api-server.git)
echo.
set /p REPO_URL="Collez l'URL de votre repo GitHub : "

if "%REPO_URL%"=="" (
    echo ❌ URL vide, abandon.
    pause
    exit /b
)

echo.
echo ========================================
echo 🔧 INITIALISATION GIT
echo ========================================

REM Initialiser Git si pas déjà fait
if not exist ".git" (
    echo 📦 Initialisation du repository Git...
    git init
    echo ✅ Git initialisé
) else (
    echo ℹ️  Git déjà initialisé
)

echo.
echo 📝 Ajout des fichiers...
git add .

echo.
echo 💾 Commit...
git commit -m "Initial commit - ANACONDA API Server"

echo.
echo 🔗 Connexion au repo GitHub...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo 🚀 Push vers GitHub...
git branch -M main
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ CODE POUSSÉ SUR GITHUB !
    echo ========================================
    echo.
    echo 📋 PROCHAINES ÉTAPES :
    echo.
    echo 1️⃣  Allez sur https://railway.app
    echo 2️⃣  Cliquez sur "New Project"
    echo 3️⃣  Sélectionnez "Deploy from GitHub repo"
    echo 4️⃣  Choisissez votre repo : %REPO_URL%
    echo 5️⃣  Dans Variables, ajoutez :
    echo     JSONBIN_MASTER_KEY=$2a$10$..I/zc0QW.o88TLtT7A40.zkUqEvhRRuGwGNGbHC/FUNSQVKyxBOK
    echo     LICENSES_BIN_ID=693450a0d0ea881f4016f644
    echo     COUNTRIES_BIN_ID=6936dfeed0ea881f401adb0a
    echo     DYNAMIC_BIN_ID=693acce6d0ea881f40220920
    echo.
    echo 6️⃣  Dans Settings, cliquez "Generate Domain"
    echo 7️⃣  Notez l'URL générée !
    echo.
) else (
    echo.
    echo ❌ Erreur lors du push
    echo.
    echo 🔍 Vérifiez :
    echo    - Que vous êtes connecté à GitHub
    echo    - Que l'URL du repo est correcte
    echo    - Que vous avez les droits d'accès
    echo.
)

pause
