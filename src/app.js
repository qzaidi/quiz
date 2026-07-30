import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

// Trust X-Forwarded-* headers from a reverse proxy (nginx, Cloudflare, ...)
// so req.protocol/req.host reflect the public URL, e.g. https://snapquiz.uk
app.set('trust proxy', true);

// Enable compression for all responses
app.use(compression());

// Static files. In production (after `npm run build`) the optimized,
// content-hashed assets in dist/ are served first. public/ stays mounted as
// a fallback for development and for files generated at runtime (QR codes).
//
// Cache strategy:
// - Hashed assets (app-3f9a1c2e.js etc.): immutable, 1 year — a content
//   change produces a new filename, so stale cache entries are never reused.
// - HTML: no-cache — always revalidated (cheap 304 via ETag), so new deploys
//   (which reference new hashed filenames) take effect immediately.
const distDir = path.join(__dirname, '../dist');
const publicDir = path.join(__dirname, '../public');
const hasDistBuild = isProduction && fs.existsSync(path.join(distDir, 'index.html'));

const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (hasDistBuild) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
};

if (hasDistBuild) {
    app.use(express.static(distDir, staticOptions));
}
app.use(express.static(publicDir, staticOptions));

// Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Start server unless explicitly disabled (for Vitest integration tests)
// Playwright E2E tests will start the server via webServer config
if (process.env.DISABLE_SERVER_START !== 'true') {
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
