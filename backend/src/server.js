import 'dotenv/config';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import webhookRouter from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../..', 'frontend/dist');
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: false, // Mapbox GL needs inline styles/workers
}));

// In production the frontend is served from the same origin — no CORS needed for it.
// Keep CORS only for local dev.
if (!isProd) {
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH'],
  }));
}

app.use(express.json());
app.use(cookieParser());

app.use('/api', apiRouter);
app.use('/auth', authRouter);
app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built frontend in production
if (isProd && existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('/{*path}', (_req, res) => res.sendFile(join(DIST, 'index.html')));
}

const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏃 on-your-left API running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
