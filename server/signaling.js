import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerRoutes } from './routes.js';
import { handleWebSocket } from './ws-handler.js';
import { initSchema, shutdown as shutdownDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8443;
const PUBLIC_DIR = join(__dirname, '..', 'public');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '4mb' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

registerRoutes(app);

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/', (_req, res) => res.sendFile(join(PUBLIC_DIR, 'index.html')));
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/telemetry/stream' });
wss.on('connection', handleWebSocket);

bootstrap().catch((e) => {
  console.error('[SC] startup failed:', e);
  process.exit(1);
});

async function bootstrap() {
  await initSchema();
  server.listen(PORT, () => {
    console.log(`[SC] listening on :${PORT}`);
  });
}

async function shutdown(sig) {
  console.log(`[SC] ${sig} — shutting down`);
  try { wss.close(); } catch {}
  server.close(() => {});
  await shutdownDb();
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
