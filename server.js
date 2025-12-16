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

// 0️⃣ Route racine
app.get('/', (req, res) => {
    res.json({ 
        message: '🐍 ANACONDA API Server',
        version: '2.0.0',
        endpoints: [
            'GET /api/config - Get initial configuration',
            'GET /api/licenses - Get all licenses (secure)',
            'PUT /api/licenses/update - Update licenses (secure)',
            'GET /api/countries - Get countries configuration',
            'GET /api/dynamic - Get dynamic configuration',
            'POST /api/verify-license - Verify a license key',
            'POST /api/update-hwid - Update HWID for a license',
            'POST /api/send-telegram - Send Telegram notification',
            'GET /health - Health check'
        ]
    });
});

// 1️⃣ Endpoint de configuration initiale (pour le userscript)
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
        console.log('📦 COUNTRIES_BIN_ID:', config.COUNTRIES_BIN_ID ? 'Present ✓' : 'Missing ✗');
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

// 2️⃣ GET /api/licenses - Récupérer toutes les licences (sécurisé)
app.get('/api/licenses', async (req, res) => {
    try {
        console.log('📡 Fetching licenses from JSONBin...');
        
        const response = await fetch(JSONBIN_CONFIGS.licenses.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!response.ok) {
            throw new Error(`JSONBin returned status ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Licenses fetched successfully');
        
        // Retourner directement le record (format attendu par le client)
        res.json(data.record || data);
        
    } catch (error) {
        console.error('❌ Error fetching licenses:', error);
        res.status(500).json({ 
            error: 'Failed to fetch licenses',
            message: error.message
        });
    }
});

// 3️⃣ PUT /api/licenses/update - Mettre à jour les licences (sécurisé)
app.put('/api/licenses/update', async (req, res) => {
    try {
        console.log('📝 Updating licenses in JSONBin...');
        
        const response = await fetch(JSONBIN_CONFIGS.licenses.UPDATE_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            throw new Error(`JSONBin returned status ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Licenses updated successfully');
        
        res.json({ 
            success: true, 
            data: data 
        });
        
    } catch (error) {
        console.error('❌ Error updating licenses:', error);
        res.status(500).json({ 
            error: 'Failed to update licenses',
            message: error.message
        });
    }
});

// 4️⃣ GET /api/countries - Récupérer la configuration des pays
app.get('/api/countries', async (req, res) => {
    try {
        console.log('🌍 Fetching countries config from JSONBin...');
        
        const response = await fetch(JSONBIN_CONFIGS.countries.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.countries.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!response.ok) {
            throw new Error(`JSONBin returned status ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Countries config fetched successfully');
        
        // Retourner directement le record
        res.json(data.record || data);
        
    } catch (error) {
        console.error('❌ Error fetching countries config:', error);
        res.status(500).json({ 
            error: 'Failed to fetch countries config',
            message: error.message
        });
    }
});

// 5️⃣ GET /api/dynamic - Récupérer la configuration dynamique
app.get('/api/dynamic', async (req, res) => {
    try {
        console.log('🔧 Fetching dynamic config from JSONBin...');
        
        const response = await fetch(JSONBIN_CONFIGS.dynamic.API_URL, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIGS.dynamic.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!response.ok) {
            throw new Error(`JSONBin returned status ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Dynamic config fetched successfully');
        
        // Retourner directement le record
        res.json(data.record || data);
        
    } catch (error) {
        console.error('❌ Error fetching dynamic config:', error);
        res.status(500).json({ 
            error: 'Failed to fetch dynamic config',
            message: error.message
        });
    }
});

// 6️⃣ POST /api/verify-license - Vérifier une licence + HWID
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
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch licenses from JSONBin');
        }

        const data = await response.json();
        const licenses = data.record || data;

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

// 7️⃣ POST /api/update-hwid - Mettre à jour le HWID d'une licence
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
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!getResponse.ok) {
            throw new Error('Failed to fetch licenses');
        }

        const data = await getResponse.json();
        const licenses = data.record || data;

        // Trouver et mettre à jour la licence
        const licenseIndex = licenses.authorizedKeys.findIndex(k => k.key === licenseKey);

        if (licenseIndex === -1) {
            return res.json({ 
                success: false, 
                error: 'License not found' 
            });
        }

        licenses.authorizedKeys[licenseIndex].hwid = hwid;
        licenses.authorizedKeys[licenseIndex].hwidUpdatedAt = new Date().toISOString();

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

        console.log(`✅ HWID updated for ${licenseKey}: ${hwid}`);
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

// 8️⃣ POST /api/send-telegram - Envoyer notification Telegram (sécurisé)
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
                'X-Master-Key': JSONBIN_CONFIGS.licenses.MASTER_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!licenseResponse.ok) {
            throw new Error('Failed to verify license');
        }

        const licenseData = await licenseResponse.json();
        const licenses = licenseData.record || licenseData;
        const license = licenses.authorizedKeys.find(k => k.key === licenseKey);

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

// 9️⃣ GET /health - Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🐍 ANACONDA API SERVER STARTED');
    console.log('========================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔒 Security: All JSONBin keys are server-side only`);
    console.log(`📡 Endpoints available: 9`);
    console.log('========================================');
    console.log('🔑 Environment Variables:');
    console.log(`  LICENSES_BIN_ID: ${process.env.LICENSES_BIN_ID ? '✓' : '✗'}`);
    console.log(`  COUNTRIES_BIN_ID: ${process.env.COUNTRIES_BIN_ID ? '✓' : '✗'}`);
    console.log(`  DYNAMIC_BIN_ID: ${process.env.DYNAMIC_BIN_ID ? '✓' : '✗'}`);
    console.log(`  JSONBIN_MASTER_KEY: ${process.env.JSONBIN_MASTER_KEY ? '✓' : '✗'}`);
    console.log(`  TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✓' : '✗'}`);
    console.log('========================================');
});
