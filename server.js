// ========================================
// 🐍 ANACONDA API SERVER - Railway Deploy
// ========================================
// Serveur API pour cacher les clés JSONBin + BROADCASTER

const express = require('express');
const http = require('http');  // ← NOUVEAU pour WebSocket
const WebSocket = require('ws');  // ← NOUVEAU
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const server = http.createServer(app);  // ← MODIFIÉ: créer server HTTP

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
// 📡 BROADCASTER CONFIG (NOUVEAU)
// ========================================
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || 'ANACONDA_BROADCAST_KEY_2025';

let broadcastStats = {
    totalNotifications: 0,
    totalClients: 0,
    activeClients: 0,
    lastNotification: null,
    startTime: new Date()
};

const broadcastClients = new Map();

// ========================================
// 📡 BROADCASTER FUNCTIONS (NOUVEAU)
// ========================================

function parseNotification(message) {
    const notification = {
        country: null,
        center: null,
        visaType: null,
        date: null,
        raw: message,
        timestamp: new Date().toISOString()
    };

    const text = message.toLowerCase();

    // Pays
    const countries = {
        'sweden': ['sweden', 'suède', '🇸🇪', 'swe'],
        'finland': ['finland', 'finlande', '🇫🇮', 'fin'],
        'croatia': ['croatia', 'croatie', '🇭🇷', 'cro'],
        'malta': ['malta', 'malte', '🇲🇹', 'mlt'],
        'austria': ['austria', 'autriche', '🇦🇹', 'aut'],
        'denmark': ['denmark', 'danemark', '🇩🇰', 'dnk']
    };

    for (const [country, keywords] of Object.entries(countries)) {
        if (keywords.some(k => text.includes(k))) {
            notification.country = country;
            break;
        }
    }

    // Centre
    const centers = {
        'rabat': ['rabat', 'rbt'],
        'casablanca': ['casablanca', 'casa', 'cas'],
        'tanger': ['tanger', 'tangier', 'tan']
    };

    for (const [center, keywords] of Object.entries(centers)) {
        if (keywords.some(k => text.includes(k))) {
            notification.center = center;
            break;
        }
    }

    // Type de visa
    const visaTypes = {
        'tourist': ['tourist', 'touriste', 'tour', 'tourism'],
        'family_visit': ['family', 'famille', 'visit', 'visite'],
        'business': ['business', 'affaires', 'travail'],
        'short_stay': ['short stay', 'court séjour', 'schengen']
    };

    for (const [type, keywords] of Object.entries(visaTypes)) {
        if (keywords.some(k => text.includes(k))) {
            notification.visaType = type;
            break;
        }
    }

    // Date
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
        notification.date = dateMatch[0];
    }

    return notification;
}

function broadcastNotification(notification) {
    const payload = JSON.stringify({
        type: 'SLOT_AVAILABLE',
        data: notification
    });

    let sentCount = 0;

    broadcastClients.forEach((clientInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
            sentCount++;
        }
    });

    console.log(`✅ Broadcast envoyé à ${sentCount} client(s)`);
    return sentCount;
}

// ========================================
// 📡 WEBSOCKET INIT (NOUVEAU)
// ========================================

const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws'
});

wss.on('connection', (ws, req) => {
    const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    broadcastClients.set(ws, {
        id: clientId,
        ip: clientIp,
        connectedAt: new Date(),
        country: null,
        center: null
    });

    broadcastStats.totalClients++;
    broadcastStats.activeClients = broadcastClients.size;

    console.log(`🔗 Client broadcaster: ${clientId} (Actifs: ${broadcastStats.activeClients})`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        clientId: clientId,
        message: '🐍 ANACONDA Broadcaster connecté!',
        stats: {
            activeClients: broadcastStats.activeClients,
            totalNotifications: broadcastStats.totalNotifications
        }
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'CONFIG') {
                const clientInfo = broadcastClients.get(ws);
                clientInfo.country = data.country;
                clientInfo.center = data.center;
                console.log(`⚙️ Client ${clientInfo.id}: ${data.country} - ${data.center}`);
            }

            if (data.type === 'PING') {
                ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            }
        } catch (err) {
            console.error('❌ Erreur message broadcaster:', err);
        }
    });

    ws.on('close', () => {
        const clientInfo = broadcastClients.get(ws);
        broadcastClients.delete(ws);
        broadcastStats.activeClients = broadcastClients.size;
        console.log(`🔌 Client déconnecté: ${clientInfo?.id} (Actifs: ${broadcastStats.activeClients})`);
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

console.log('🐍 Broadcaster WebSocket initialisé sur /ws');

// ========================================
// 🔐 API ENDPOINTS (VOTRE CODE EXISTANT)
// ========================================

// 0️⃣ Route racine (MODIFIÉE - ajout broadcaster)
app.get('/', (req, res) => {
    res.json({ 
        message: '🐍 ANACONDA API Server + Broadcaster',
        version: '2.1.0',
        broadcaster: {
            active: true,
            clients: broadcastStats.activeClients,
            notifications: broadcastStats.totalNotifications
        },
        endpoints: [
            'GET /api/config - Get initial configuration',
            'GET /api/licenses - Get all licenses (secure)',
            'PUT /api/licenses/update - Update licenses (secure)',
            'GET /api/countries - Get countries configuration',
            'GET /api/dynamic - Get dynamic configuration',
            'POST /api/verify-license - Verify a license key',
            'POST /api/update-hwid - Update HWID for a license',
            'POST /api/send-telegram - Send Telegram notification',
            'GET /health - Health check',
            '--- BROADCASTER ---',
            'WebSocket /ws - Broadcaster client connection',
            'POST /broadcast/notify - Send notification to all clients',
            'GET /broadcast/stats - Broadcaster statistics',
            'GET /broadcast/health - Broadcaster health check'
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

        const license = licenses.authorizedKeys.find(k => k.key === licenseKey);

        if (!license) {
            return res.json({ 
                success: false, 
                error: 'Invalid license key' 
            });
        }

        if (!license.active) {
            return res.json({ 
                success: false, 
                error: 'License is inactive' 
            });
        }

        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            return res.json({ 
                success: false, 
                error: 'License has expired' 
            });
        }

        if (license.hwid && license.hwid !== hwid) {
            return res.json({ 
                success: false, 
                error: 'HWID mismatch - This license is locked to another device' 
            });
        }

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

        let isFirstActivation = false;
        if (!license.hwid || license.hwid === null) {
            isFirstActivation = true;
            
            const licenseIndex = licenses.authorizedKeys.findIndex(k => k.key === licenseKey);
            licenses.authorizedKeys[licenseIndex].hwid = hwid;
            licenses.authorizedKeys[licenseIndex].hwidRegisteredAt = new Date().toISOString();
            
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
                license.hwid = hwid;
                license.hwidRegisteredAt = licenses.authorizedKeys[licenseIndex].hwidRegisteredAt;
            }
        }

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

        const licenseIndex = licenses.authorizedKeys.findIndex(k => k.key === licenseKey);

        if (licenseIndex === -1) {
            return res.json({ 
                success: false, 
                error: 'License not found' 
            });
        }

        licenses.authorizedKeys[licenseIndex].hwid = hwid;
        licenses.authorizedKeys[licenseIndex].hwidUpdatedAt = new Date().toISOString();

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
        uptime: process.uptime(),
        broadcaster: {
            active: true,
            clients: broadcastStats.activeClients
        }
    });
});

// ========================================
// 📡 BROADCASTER ROUTES (NOUVEAU)
// ========================================

// 🔟 POST /broadcast/notify - Recevoir notification Telegram
app.post('/broadcast/notify', (req, res) => {
    const { message, secret } = req.body;

    if (secret !== BROADCAST_SECRET) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized - Invalid secret key'
        });
    }

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    console.log('\n📨 ========================================');
    console.log('📨 BROADCASTER: NOTIFICATION');
    console.log(`📝 Message: ${message}`);

    const notification = parseNotification(message);
    console.log(`🔍 Parsed: ${notification.country} - ${notification.center} - ${notification.visaType}`);

    const sentCount = broadcastNotification(notification);

    broadcastStats.totalNotifications++;
    broadcastStats.lastNotification = notification;

    console.log('📨 ========================================\n');

    res.json({
        success: true,
        notification: notification,
        clientsNotified: sentCount,
        timestamp: new Date().toISOString()
    });
});

// 1️⃣1️⃣ GET /broadcast/stats - Statistiques broadcaster
app.get('/broadcast/stats', (req, res) => {
    const uptime = Math.floor((new Date() - broadcastStats.startTime) / 1000);

    res.json({
        ...broadcastStats,
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        clients: Array.from(broadcastClients.values()).map(c => ({
            id: c.id,
            ip: c.ip.replace(/^::ffff:/, ''),
            country: c.country,
            center: c.center,
            connectedFor: Math.floor((new Date() - c.connectedAt) / 1000) + 's'
        }))
    });
});

// 1️⃣2️⃣ GET /broadcast/health - Health check broadcaster
app.get('/broadcast/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'anaconda-broadcaster',
        version: '1.0.0',
        clients: broadcastStats.activeClients,
        uptime: Math.floor((new Date() - broadcastStats.startTime) / 1000)
    });
});

// ========================================
// 🚀 START SERVER (MODIFIÉ)
// ========================================
server.listen(PORT, () => {  // ← MODIFIÉ: utiliser 'server' au lieu de 'app'
    console.log('========================================');
    console.log('🐍 ANACONDA API SERVER + BROADCASTER');
    console.log('========================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔒 Security: All JSONBin keys are server-side only`);
    console.log(`📡 API Endpoints: 9`);
    console.log(`📡 Broadcaster Endpoints: 3`);
    console.log(`📡 WebSocket: /ws (Clients: ${broadcastStats.activeClients})`);
    console.log('========================================');
    console.log('🔑 Environment Variables:');
    console.log(`  LICENSES_BIN_ID: ${process.env.LICENSES_BIN_ID ? '✓' : '✗'}`);
    console.log(`  COUNTRIES_BIN_ID: ${process.env.COUNTRIES_BIN_ID ? '✓' : '✗'}`);
    console.log(`  DYNAMIC_BIN_ID: ${process.env.DYNAMIC_BIN_ID ? '✓' : '✗'}`);
    console.log(`  JSONBIN_MASTER_KEY: ${process.env.JSONBIN_MASTER_KEY ? '✓' : '✗'}`);
    console.log(`  TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✓' : '✗'}`);
    console.log(`  BROADCAST_SECRET: ${process.env.BROADCAST_SECRET ? '✓' : '✗'}`);
    console.log('========================================');
});
