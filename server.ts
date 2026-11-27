import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'school-erp-dev-secret-change-in-production';
}

const authRoutes = require('./backend/src/routes/auth');
const studentRoutes = require('./backend/src/routes/students');
const classRoutes = require('./backend/src/routes/classes');
const admissionRoutes = require('./backend/src/routes/admissions');
const attendanceRoutes = require('./backend/src/routes/attendance');
const holidayRoutes = require('./backend/src/routes/holidays');
const examRoutes = require('./backend/src/routes/exams');
const gradeScaleRoutes = require('./backend/src/routes/gradeScales');
const staffRoutes = require('./backend/src/routes/staff');
const busRoutes = require('./backend/src/routes/bus');
const staffAccessRoutes = require('./backend/src/routes/staffAccess');
const meRoutes = require('./backend/src/routes/me');
const timetableRoutes = require('./backend/src/routes/timetable');
const timetableArrangementRoutes = require('./backend/src/routes/timetableArrangements');

async function startServer() {
  const app = express();

  const rawOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: rawOrigins.length ? rawOrigins : '*' }));
  const rawRemote = (process.env.REMOTE_API_URL || '').trim().replace(/\/+$/, '');
  const REMOTE_API_URL =
    rawRemote === 'local'
      ? 'local'
      : !rawRemote || rawRemote.includes('school-erp-imsbf-83.vercel.app')
        ? 'https://school-erp-x967.onrender.com/api'
        : rawRemote.endsWith('/api')
          ? rawRemote
          : `${rawRemote}/api`;

  if (REMOTE_API_URL && REMOTE_API_URL !== 'local') {
    app.use('/api', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
      const targetUrl = `${REMOTE_API_URL}${req.url}`;
      const headers: Record<string, string> = {};
      if (req.headers.authorization) headers['authorization'] = String(req.headers.authorization);
      if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
      if (req.headers.accept) headers['accept'] = String(req.headers.accept);

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const bodyBuffer =
        hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;

      try {
        const upstream = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
          signal: AbortSignal.timeout(45000),
        });
        res.status(upstream.status);
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('content-type', ct);
        const buf = Buffer.from(await upstream.arrayBuffer());
        return res.send(buf);
      } catch (err: any) {
        console.error('Upstream API proxy error:', err);
        return res.status(502).json({
          error:
            'Could not reach the live backend server. If it is waking up from sleep, please try again in a few seconds.',
        });
      }
    });
  }

  app.use(express.json({ limit: '5mb' }));

  const SERVER_BOOT_ID = new Date().toISOString();
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), bootId: SERVER_BOOT_ID });
  });
  if (process.env.NODE_ENV !== 'production') {
    app.get('/version.json', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ buildId: SERVER_BOOT_ID, builtAt: SERVER_BOOT_ID });
    });
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/admissions', admissionRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/holidays', holidayRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/grade-scales', gradeScaleRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/bus', busRoutes);
  app.use('/api/staff-access', staffAccessRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/timetable/arrangements', timetableArrangementRoutes);
  app.use('/api/timetable', timetableRoutes);

  // Return JSON 404 for unknown API endpoints
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete: other records still reference this item.' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A record with those unique details already exists.' });
    }
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'disable-hmr-client-ws',
              transform(code: string, id: string) {
                if (id.endsWith('/dist/client/client.mjs')) {
                  return code.replace(
                    /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
                    'let wsTransport = { async connect() {}, async disconnect() {}, send() {} };'
                  );
                }
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`The Register — School ERP running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
