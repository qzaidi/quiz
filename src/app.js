import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import { setupWebSocket } from './websocket.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Database
initDb();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Start Server
const server = app.listen(port, () => {
    console.log(`Quiz app listening on port ${port}`);
});

// Setup WebSocket
setupWebSocket(server);
