// ========================================
// 🐍 ANACONDA API SERVER - Railway Deploy
// ========================================
// Serveur API pour cacher les clés JSONBin

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ========================================
// 📋 CONFIGURATION JSONBIN (depuis .env)
// ========================================
const JSONBIN_CONFIGS = {
    licenses: {
        BIN_ID: process.env.LICENSES_BIN_ID,
        MASTER_KEY: process.env.JSONBIN_MASTER_KEY,
        API_URL: `https://api.jsonbin.io/v3/b/${process.env.LICENSES_BIN_ID}/latest`,
        UPDATE_URL: `https://api.jsonbin.io/v3/b/${process.env.LICENSES_BIN_ID}`
    },
    countries: {
        BIN_ID: process.env.COUNTRIES_BIN_ID,
        MASTER_KEY: process.env.JSONBIN_MASTER_KEY,
        API_URL: `https://api.jsonbin.io/v3/b/${process.env.COUNTRIES_BIN_ID}/latest`
    },
    dynamic: {
        BIN_ID: process.env.DYNAMIC_BIN_ID,
        MASTER_KEY: process.env.JSONBIN_MASTER_KEY,
        API_URL: `https://api.jsonbin.io/v3/b/${process.env.DYNAMIC_BIN_ID}/latest`
    }
};

// ========================================
// 🔐 API ENDPOINTS
// ========================================

// 1️⃣ Vérifier une licence + HWID
app.post('/api/verify-license', async (req, res) => {
    try {
        const { licenseKey, hwid } = req.body;

        if (!licenseKey || !hwid) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key and HWID required' 
            });
        }

        // Récupérer les licences depuis JSONBin
        const response = await fetch(JSONBIN_CONFIGS.licenses.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch licenses from JSONBin');
        }

        const data = await response.json();
        const licenses = data.record;

        // Chercher la licence
        const license = licenses.authorizedKeys.find(k => k.key === licenseKey);

        if (!license) {
            return res.json({ 
                success: false, 
                error: 'Invalid license key' 
            });
        }

        // Vérifier si la licence est active
        if (!license.active) {
            return res.json({ 
                success: false, 
                error: 'License is inactive' 
            });
        }

        // Vérifier l'expiration
        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            return res.json({ 
                success: false, 
                error: 'License has expired' 
            });
        }

        // Vérifier le HWID
        if (license.hwid && license.hwid !== hwid) {
            return res.json({ 
                success: false, 
                error: 'HWID mismatch - This license is locked to another device' 
            });
        }

        // Vérifier la blacklist
        if (licenses.blacklist?.keys?.includes(licenseKey)) {
            return res.json({ 
                success: false, 
                error: 'License has been revoked' 
            });
        }

        if (licenses.blacklist?.hwids?.includes(hwid)) {
            return res.json({ 
                success: false, 
                error: 'Device has been blacklisted' 
            });
        }

        // 🔧 PREMIÈRE ACTIVATION : Enregistrer le HWID automatiquement
        let isFirstActivation = false;
        if (!license.hwid || license.hwid === null) {
            isFirstActivation = true;
            
            // Mettre à jour le HWID dans JSONBin
            const licenseIndex = licenses.authorizedKeys.findIndex(k => k.key === licenseKey);
            licenses.authorizedKeys[licenseIndex].hwid = hwid;
            licenses.authorizedKeys[licenseIndex].hwidRegisteredAt = new Date().toISOString();
            
            // Enregistrer dans JSONBin
            const updateResponse = await fetch(JSONBIN_CONFIGS.licenses.UPDATE_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
                },
                body: JSON.stringify(licenses)
            });

            if (!updateResponse.ok) {
                console.error('Failed to update HWID in JSONBin');
            } else {
                console.log(`✅ HWID registered for ${licenseKey}: ${hwid}`);
                // Mettre à jour l'objet license pour la réponse
                license.hwid = hwid;
                license.hwidRegisteredAt = licenses.authorizedKeys[licenseIndex].hwidRegisteredAt;
            }
        }

        // ✅ Licence valide
        res.json({ 
            success: true,
            firstActivation: isFirstActivation,
            license: {
                key: license.key,
                user: license.user,
                active: license.active,
                hwid: license.hwid,
                expiresAt: license.expiresAt,
                maxBookings: license.maxBookings,
                bookingsCount: license.bookingsCount,
                telegramNotif: license.telegramNotif,
                telegramAdmin: license.telegramAdmin
            }
        });

    } catch (error) {
        console.error('Error verifying license:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// 2️⃣ Mettre à jour le HWID d'une licence
app.post('/api/update-hwid', async (req, res) => {
    try {
        const { licenseKey, hwid } = req.body;

        if (!licenseKey || !hwid) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key and HWID required' 
            });
        }

        // Récupérer les licences
        const getResponse = await fetch(JSONBIN_CONFIGS.licenses.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
            }
        });

        const data = await getResponse.json();
        const licenses = data.record;

        // Trouver et mettre à jour la licence
        const licenseIndex = licenses.authorizedKeys.findIndex(k => k.key === licenseKey);

        if (licenseIndex === -1) {
            return res.json({ 
                success: false, 
                error: 'License not found' 
            });
        }

        licenses.authorizedKeys[licenseIndex].hwid = hwid;

        // Mettre à jour JSONBin
        const updateResponse = await fetch(JSONBIN_CONFIGS.licenses.UPDATE_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
            },
            body: JSON.stringify(licenses)
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update JSONBin');
        }

        res.json({ 
            success: true, 
            message: 'HWID updated successfully' 
        });

    } catch (error) {
        console.error('Error updating HWID:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// 3️⃣ Récupérer la configuration des pays
app.get('/api/countries-config', async (req, res) => {
    try {
        const response = await fetch(JSONBIN_CONFIGS.countries.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.countries.MASTER_KEY
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch countries config');
        }

        const data = await response.json();
        res.json({ 
            success: true, 
            config: data.record 
        });

    } catch (error) {
        console.error('Error fetching countries config:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// 4️⃣ Récupérer la configuration dynamique
app.get('/api/dynamic-config', async (req, res) => {
    try {
        const response = await fetch(JSONBIN_CONFIGS.dynamic.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.dynamic.MASTER_KEY
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch dynamic config');
        }

        const data = await response.json();
        res.json({ 
            success: true, 
            config: data.record 
        });

    } catch (error) {
        console.error('Error fetching dynamic config:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// 5️⃣ Envoyer notification Telegram (sécurisé)
app.post('/api/send-telegram', async (req, res) => {
    try {
        const { chatId, message, licenseKey } = req.body;

        if (!chatId || !message || !licenseKey) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: chatId, message, licenseKey' 
            });
        }

        // Vérifier que la licence est valide avant d'envoyer
        const licenseResponse = await fetch(JSONBIN_CONFIGS.licenses.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
            }
        });

        if (!licenseResponse.ok) {
            throw new Error('Failed to verify license');
        }

        const licenseData = await licenseResponse.json();
        const license = licenseData.record.authorizedKeys.find(k => k.key === licenseKey);

        if (!license || !license.active) {
            return res.json({ 
                success: false, 
                error: 'Invalid or inactive license' 
            });
        }

        // Envoyer le message Telegram via le BOT_TOKEN sécurisé
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!telegramBotToken) {
            console.error('TELEGRAM_BOT_TOKEN not configured');
            return res.status(500).json({ 
                success: false, 
                error: 'Telegram not configured' 
            });
        }

        const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        
        const telegramResponse = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const telegramResult = await telegramResponse.json();

        if (telegramResult.ok) {
            console.log(`✅ Telegram message sent to ${chatId}`);
            res.json({ success: true, messageId: telegramResult.result.message_id });
        } else {
            console.error('Telegram API error:', telegramResult);
            res.json({ success: false, error: 'Failed to send Telegram message' });
        }

    } catch (error) {
        console.error('Error sending Telegram:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// 6️⃣ Endpoint pour récupérer la configuration (pour le userscript)
app.get('/api/config', (req, res) => {
    try {
        const config = {
            DYNAMIC_BIN_ID: process.env.DYNAMIC_BIN_ID,
            LICENSES_BIN_ID: process.env.LICENSES_BIN_ID,
            COUNTRIES_BIN_ID: process.env.COUNTRIES_BIN_ID,
            JSONBIN_MASTER_KEY: process.env.JSONBIN_MASTER_KEY,
            TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN
        };

        console.log('📡 Config requested');
        console.log('📦 DYNAMIC_BIN_ID:', config.DYNAMIC_BIN_ID ? 'Present ✓' : 'Missing ✗');
        console.log('📦 LICENSES_BIN_ID:', config.LICENSES_BIN_ID ? 'Present ✓' : 'Missing ✗');
        console.log('🔑 MASTER_KEY:', config.JSONBIN_MASTER_KEY ? 'Present ✓' : 'Missing ✗');
        console.log('📱 BOT_TOKEN:', config.TELEGRAM_BOT_TOKEN ? 'Present ✓' : 'Missing ✗');

        res.json(config);
    } catch (error) {
        console.error('❌ Error in /api/config:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// 6️⃣ Route racine
app.get('/', (req, res) => {
    res.json({ 
        message: '🐍 ANACONDA API Server',
        version: '1.0.0',
        endpoints: [
            'POST /api/verify-license',
            'POST /api/update-hwid',
            'GET /api/countries-config',
            'GET /api/dynamic-config',
            'GET /health'
        ]
    });
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`🐍 ANACONDA API Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
