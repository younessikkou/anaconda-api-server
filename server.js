const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BROADCAST_SECRET = process.env.BROADCAST_SECRET || 'changeme';
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// ========================================
// WEBSOCKET SERVER POUR BROADCAST WAITLIST
// ========================================
const wss = new WebSocketServer({ server, path: '/ws/waitlist' });

const connectedPCs = new Map(); // ws -> { pcName, connectedAt, lastPing }

wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[WS] Nouvelle connexion depuis ${ip}`);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);

            // Authentification
            if (data.type === 'auth') {
                if (data.secret !== BROADCAST_SECRET) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid secret' }));
                    ws.close();
                    return;
                }
                const pcName = data.pcName || `PC-${connectedPCs.size + 1}`;
                connectedPCs.set(ws, { pcName, connectedAt: new Date(), lastPing: new Date() });
                ws.pcName = pcName;

                // Confirmer l'authentification
                ws.send(JSON.stringify({
                    type: 'auth_ok',
                    pcName,
                    totalPCs: connectedPCs.size,
                    timestamp: Date.now()
                }));

                // Notifier tous les PCs du nouveau membre
                broadcastToPCs({
                    type: 'pc_joined',
                    pcName,
                    totalPCs: connectedPCs.size,
                    timestamp: Date.now()
                }, ws);

                console.log(`[WS] PC authentifié: ${pcName} (Total: ${connectedPCs.size})`);
                return;
            }

            // Vérifier que le PC est authentifié
            if (!connectedPCs.has(ws)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                return;
            }

            // WAITLIST DÉTECTÉ → Broadcast à tous les autres PCs
            if (data.type === 'waitlist_detected') {
                const sender = connectedPCs.get(ws);
                console.log(`[WAITLIST] Détecté par ${sender.pcName} - Broadcasting à ${connectedPCs.size - 1} PC(s)`);

                broadcastToPCs({
                    type: 'trigger_booking_remote',
                    source: sender.pcName,
                    center: data.center || 'BOTH',
                    centerCode: data.centerCode || '',
                    detectedBy: sender.pcName,
                    timestamp: Date.now()
                }, ws); // Exclure l'émetteur (il déclenche déjà localement)

                // Confirmer à l'émetteur
                ws.send(JSON.stringify({
                    type: 'waitlist_broadcast_confirmed',
                    sentTo: connectedPCs.size - 1,
                    timestamp: Date.now()
                }));
            }

            // Ping/keepalive
            if (data.type === 'ping') {
                const pc = connectedPCs.get(ws);
                if (pc) pc.lastPing = new Date();
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }

            // Statut - demander la liste des PCs connectés
            if (data.type === 'get_status') {
                const pcList = [];
                connectedPCs.forEach((info) => {
                    pcList.push({ pcName: info.pcName, connectedAt: info.connectedAt });
                });
                ws.send(JSON.stringify({
                    type: 'status',
                    totalPCs: connectedPCs.size,
                    pcs: pcList,
                    timestamp: Date.now()
                }));
            }

        } catch (e) {
            console.error('[WS] Erreur parsing message:', e);
        }
    });

    ws.on('close', () => {
        const pc = connectedPCs.get(ws);
        const pcName = pc ? pc.pcName : 'Unknown';
        connectedPCs.delete(ws);
        console.log(`[WS] PC déconnecté: ${pcName} (Restant: ${connectedPCs.size})`);

        // Notifier les autres PCs
        broadcastToPCs({
            type: 'pc_left',
            pcName,
            totalPCs: connectedPCs.size,
            timestamp: Date.now()
        });
    });

    ws.on('error', (err) => {
        console.error('[WS] Erreur:', err.message);
        connectedPCs.delete(ws);
    });
});

function broadcastToPCs(message, excludeWs = null) {
    const msg = JSON.stringify(message);
    connectedPCs.forEach((info, ws) => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    });
}

// Ping interval pour détecter les déconnexions
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            connectedPCs.delete(ws);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// ========================================
// REST API (existante + status)
// ========================================
app.get('/', (req, res) => {
    res.json({
        service: 'anaconda-api-server',
        version: '3.0.0',
        status: 'running',
        waitlistBroadcast: {
            connectedPCs: connectedPCs.size,
            wsPath: '/ws/waitlist'
        }
    });
});

app.get('/status', (req, res) => {
    const pcList = [];
    connectedPCs.forEach((info) => {
        pcList.push({ pcName: info.pcName, connectedAt: info.connectedAt, lastPing: info.lastPing });
    });
    res.json({ totalPCs: connectedPCs.size, pcs: pcList });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket waitlist broadcast: ws://localhost:${PORT}/ws/waitlist`);
});
