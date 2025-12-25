import { WebSocketServer } from 'ws';

const quizClients = new Map(); // quizId -> Set of ws clients

export function setupWebSocket(server) {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const quizId = parseInt(urlParams.get('quizId'));

        if (isNaN(quizId)) {
            ws.close();
            return;
        }

        if (!quizClients.has(quizId)) {
            quizClients.set(quizId, new Set());
        }
        quizClients.get(quizId).add(ws);

        // Broadcast count update
        broadcastCount(quizId);

        ws.on('close', () => {
            const clients = quizClients.get(quizId);
            if (clients) {
                clients.delete(ws);
                if (clients.size === 0) {
                    quizClients.delete(quizId);
                } else {
                    broadcastCount(quizId);
                }
            }
        });
    });

    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });

    return wss;
}

function broadcastCount(quizId) {
    const clients = quizClients.get(quizId);
    if (clients) {
        const count = clients.size;
        const message = JSON.stringify({ type: 'count', count });
        for (const client of clients) {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        }
    }
}
