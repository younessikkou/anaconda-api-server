// ========================================
// 🐍 ANACONDA API SERVER - Railway Deploy
// ========================================
// Serveur API pour cacher les clés JSONBin + BROADCASTER
// 🔐 Security Update: Admin token protection + /api/licenses SÉCURISÉ (v2.2.0)

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

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
// 📡 BROADCASTER CONFIG
// ========================================
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || 'ANACONDA_BROADCAST_KEY_2025';

// ========================================
// 🔐 SÉCURITÉ - Admin Token
// ========================================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'VlQ0zUuS4PXNqdgWyx97D3fJMhnFIbcoavBjpHAE1GiKstRr8LeTYm2Cwk56OZ';

console.log('🔐 ADMIN_TOKEN chargé:', ADMIN_TOKEN ? `${ADMIN_TOKEN.substring(0, 10)}...` : 'NON DÉFINI');

// Stockage des logs de sécurité
let securityLogs = {
    unauthorizedAttempts: [],
    invalidTokenAttempts: [],
    authorizedAccess: []
};

const MAX_LOGS = 100;

// Helper pour ajouter un log de sécurité
function addSecurityLog(type, data) {
    const log = {
        ...data,
        timestamp: new Date().toISOString()
    };
    
    if (type === 'unauthorized') {
        securityLogs.unauthorizedAttempts.unshift(log);
        if (securityLogs.unauthorizedAttempts.length > MAX_LOGS) {
            securityLogs.unauthorizedAttempts.pop();
        }
    } else if (type === 'invalid_token') {
        securityLogs.invalidTokenAttempts.unshift(log);
        if (securityLogs.invalidTokenAttempts.length > MAX_LOGS) {
            securityLogs.invalidTokenAttempts.pop();
        }
    } else if (type === 'authorized') {
        securityLogs.authorizedAccess.unshift(log);
        if (securityLogs.authorizedAccess.length > MAX_LOGS) {
            securityLogs.authorizedAccess.pop();
        }
    }
}

// Middleware d'authentification pour les endpoints sensibles
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const endpoint = req.originalUrl || req.url;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    if (!token) {
        console.warn(`⚠️ UNAUTHORIZED ACCESS ATTEMPT:`);
        console.warn(`   IP: ${clientIp}`);
        console.warn(`   Endpoint: ${endpoint}`);
        console.warn(`   Time: ${new Date().toISOString()}`);
        console.warn(`   User-Agent: ${userAgent}`);
        
        addSecurityLog('unauthorized', {
            ip: clientIp,
            endpoint: endpoint,
            userAgent: userAgent,
            reason: 'Missing token'
        });
        
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Missing Authorization header. Use: Bearer YOUR_TOKEN'
        });
    }
    
    if (token !== ADMIN_TOKEN) {
        console.error(`🚨 SECURITY ALERT - INVALID TOKEN ATTEMPT:`);
        console.error(`   IP: ${clientIp}`);
        console.error(`   Endpoint: ${endpoint}`);
        console.error(`   Token (first 10 chars): ${token.substring(0, 10)}...`);
        console.error(`   Time: ${new Date().toISOString()}`);
        console.error(`   User-Agent: ${userAgent}`);
        
        addSecurityLog('invalid_token', {
            ip: clientIp,
            endpoint: endpoint,
            tokenPreview: token.substring(0, 10) + '...',
            userAgent: userAgent,
            reason: 'Invalid token'
        });
        
        return res.status(403).json({ 
            error: 'Access denied',
            message: 'Invalid admin token'
        });
    }
    
    console.log(`✅ ADMIN ACCESS GRANTED:`);
    console.log(`   IP: ${clientIp}`);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Time: ${new Date().toISOString()}`);
    
    addSecurityLog('authorized', {
        ip: clientIp,
        endpoint: endpoint,
        userAgent: userAgent
    });
    
    next();
}

let broadcastStats = {
    totalNotifications: 0,
    totalClients: 0,
    activeClients: 0,
    lastNotification: null,
    startTime: new Date()
};

const broadcastClients = new Map();

// ========================================
// 📡 BROADCASTER FUNCTIONS
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
// 📡 WEBSOCKET INIT
// ========================================

const MAX_CLIENTS = 1000;

const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws'
});

wss.on('connection', (ws, req) => {
    if (broadcastClients.size >= MAX_CLIENTS) {
        console.warn(`⚠️ LIMITE ATTEINTE: ${MAX_CLIENTS} clients connectés`);
        ws.close(1008, 'Server full - Too many connections');
        return;
    }

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
            if (message.length > 10000) {
                console.warn(`⚠️ Message trop grand ignoré: ${message.length} bytes`);
                return;
            }

            const data = JSON.parse(message);

            const allowedTypes = ['CONFIG', 'PING'];
            if (!allowedTypes.includes(data.type)) {
                console.warn(`⚠️ Type message non autorisé: ${data.type}`);
                return;
            }

            if (data.type === 'CONFIG') {
                const clientInfo = broadcastClients.get(ws);
                if (data.country) clientInfo.country = String(data.country).substring(0, 50);
                if (data.center) clientInfo.center = String(data.center).substring(0, 50);
                console.log(`⚙️ Client ${clientInfo.id}: ${clientInfo.country} - ${clientInfo.center}`);
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
// 🔐 API ENDPOINTS SÉCURISÉS
// ========================================

// 0️⃣ Route racine
app.get('/', (req, res) => {
    res.json({ 
        message: '🐍 ANACONDA API Server + Broadcaster',
        version: '2.2.0 - SECURE',
        broadcaster: {
            active: true,
            clients: broadcastStats.activeClients,
            notifications: broadcastStats.totalNotifications
        },
        endpoints: [
            'GET /api/config - Get initial configuration (PUBLIC)',
            '🔒 GET /api/licenses - Get all licenses (PROTECTED - ADMIN ONLY)',
            '🔒 PUT /api/licenses/update - Update licenses (PROTECTED - ADMIN ONLY)',
            'GET /api/countries - Get countries configuration',
            'GET /api/dynamic - Get dynamic configuration',
            '✅ POST /api/verify-license - Verify a single license (SECURE)',
            'POST /api/update-hwid - Update HWID for a license',
            'POST /api/send-telegram - Send Telegram notification',
            'GET /health - Health check',
            '--- BROADCASTER ---',
            'WebSocket /ws - Broadcaster client connection',
            'POST /broadcast/notify - Send notification to all clients',
            'GET /broadcast/stats - Broadcaster statistics',
            'GET /broadcast/health - Broadcaster health check',
            '🔒 GET /security/logs - Security logs (PROTECTED - ADMIN ONLY)'
        ]
    });
});

// 1️⃣ Endpoint de configuration initiale (PUBLIC - SÉCURISÉ)
app.get('/api/config', (req, res) => {
    try {
        const config = {
            DYNAMIC_BIN_ID: process.env.DYNAMIC_BIN_ID,
            LICENSES_BIN_ID: process.env.LICENSES_BIN_ID,
            COUNTRIES_BIN_ID: process.env.COUNTRIES_BIN_ID
        };

        console.log('📡 Config requested (PUBLIC - SECURE)');
        res.json(config);
    } catch (error) {
        console.error('❌ Error in /api/config:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// 2️⃣ 🔒 GET /api/licenses - PROTÉGÉ PAR ADMIN TOKEN (NOUVEAU!)
app.get('/api/licenses', authenticateAdmin, async (req, res) => {
    try {
        console.log('🔐 Fetching licenses (ADMIN - PROTECTED)...');
        
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
        console.log('✅ Licenses fetched successfully (ADMIN)');
        
        res.json(data.record || data);
        
    } catch (error) {
        console.error('❌ Error fetching licenses:', error);
        res.status(500).json({ 
            error: 'Failed to fetch licenses',
            message: error.message
        });
    }
});

// 3️⃣ PUT /api/licenses/update - Mettre à jour les licences (protégé)
app.put('/api/licenses/update', authenticateAdmin, async (req, res) => {
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

// 6️⃣ ✅ POST /api/verify-license - Vérifier UNE licence (SÉCURISÉ)
app.post('/api/verify-license', async (req, res) => {
    try {
        const { licenseKey, hwid } = req.body;

        if (!licenseKey || !hwid) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key and HWID required' 
            });
        }

        // Log de sécurité
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`🔍 License verification attempt:`);
        console.log(`   IP: ${clientIp}`);
        console.log(`   Key: ${licenseKey.substring(0, 10)}...`);
        console.log(`   HWID: ${hwid.substring(0, 12)}...`);

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
            console.log(`❌ Invalid license key: ${licenseKey.substring(0, 10)}...`);
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
            console.log(`❌ HWID mismatch for ${license.user}`);
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
                console.log(`✅ HWID registered for ${licenseKey}: ${hwid.substring(0, 12)}...`);
                license.hwid = hwid;
                license.hwidRegisteredAt = licenses.authorizedKeys[licenseIndex].hwidRegisteredAt;
            }
        }

        console.log(`✅ License verified successfully: ${license.user}`);

        res.json({ 
            success: true,
            firstActivation: isFirstActivation,
            license: {
                key: license.key,
                user: license.user,
                email: license.email,
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
// 📡 BROADCASTER ROUTES
// ========================================

// 🔟 POST /broadcast/notify - Recevoir notification Telegram
app.post('/broadcast/notify', (req, res) => {
    const { message, secret } = req.body;

    if (secret !== BROADCAST_SECRET) {
        console.warn('⚠️ Tentative broadcast non autorisée');
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

    if (typeof message !== 'string' || message.length > 5000) {
        return res.status(400).json({
            success: false,
            error: 'Message must be a string (max 5000 chars)'
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

// 1️⃣3️⃣ GET /security/logs - Voir les logs de sécurité (protégé)
app.get('/security/logs', authenticateAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    res.json({
        summary: {
            totalUnauthorizedAttempts: securityLogs.unauthorizedAttempts.length,
            totalInvalidTokenAttempts: securityLogs.invalidTokenAttempts.length,
            totalAuthorizedAccess: securityLogs.authorizedAccess.length,
            lastCheck: new Date().toISOString()
        },
        recentLogs: {
            unauthorizedAttempts: securityLogs.unauthorizedAttempts.slice(0, limit),
            invalidTokenAttempts: securityLogs.invalidTokenAttempts.slice(0, limit),
            authorizedAccess: securityLogs.authorizedAccess.slice(0, limit)
        }
    });
});

// ========================================
// 🚀 START SERVER
// ========================================
server.listen(PORT, () => {
    console.log('========================================');
    console.log('🐍 ANACONDA API SERVER + BROADCASTER');
    console.log('========================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔒 Security: /api/licenses PROTECTED (v2.2.0)`);
    console.log(`🔒 Use /api/verify-license for single license check`);
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
    console.log(`  ADMIN_TOKEN: ${ADMIN_TOKEN ? '✓' : '✗'}`);
    console.log('========================================');
    console.log('🔐 SECURITY UPDATES (v2.2.0):');
    console.log('   ✅ /api/licenses is now PROTECTED (requires ADMIN_TOKEN)');
    console.log('   ✅ Clients use /api/verify-license for single license check');
    console.log('   ✅ All license data stays server-side');
    console.log('========================================');
});

