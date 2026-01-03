import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import { initDb } from './database.js';
import { setupWebSocket } from './websocket.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Database
initDb();

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Enable compression for all responses
app.use(compression());

app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: isProduction ? '1y' : 0, // Cache for 1 year in production
    immutable: isProduction
}));

// Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  // Start Server
  const server = app.listen(port, () => {
      console.log(`Quiz app listening on port ${port}`);
      console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  });

  // Setup WebSocket
  setupWebSocket(server);
}

// Export app for testing
export default app;
