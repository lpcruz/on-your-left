import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import apiRouter from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

app.use('/api', apiRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏃 on-your-left API running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
