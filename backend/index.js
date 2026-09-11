// index.js — Antarctic station backend entry point
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const telemetryRouter = require('./routes/telemetry');
const scenarioRouter = require('./routes/scenario');
const { startSimulation, getState } = require('./stationState');
const CONSTANTS = require('./constants');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'production';

// ---------------------------------------------------------------------------
// Security & Middleware
// ---------------------------------------------------------------------------

// CORS Configuration
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  process.env.ALLOWED_ORIGINS ||
  process.env.PENGUIN_CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000'
)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isWildcardCors = allowedOrigins.includes('*');

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (
        !origin ||
        isWildcardCors ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: !isWildcardCors,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Request body limits
app.use(express.json({ limit: '100kb' }));

// In-memory rate limiter per IP (120 req/min, excluding health checks)
const clientRequests = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_CALLS = parseInt(process.env.RATE_LIMIT_MAX_CALLS || '120', 10);

app.use((req, res, next) => {
  if (req.path.startsWith('/health') || req.path.startsWith('/api/health')) {
    return next();
  }

  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = (clientRequests.get(clientIp) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  clientRequests.set(clientIp, timestamps);

  if (timestamps.length > RATE_LIMIT_MAX_CALLS) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_CALLS} requests per minute.`,
    });
  }

  // Periodic pruning
  if (clientRequests.size > 500) {
    for (const [ip, list] of clientRequests.entries()) {
      if (!list.length || now - list[list.length - 1] > RATE_LIMIT_WINDOW_MS) {
        clientRequests.delete(ip);
      }
    }
  }

  next();
});

// ---------------------------------------------------------------------------
// Health Checks (Phase 3 Reliability)
// ---------------------------------------------------------------------------

const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    service: 'antarctic-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
};

const livenessHandler = (req, res) => {
  res.json({
    status: 'alive',
    service: 'antarctic-backend',
    timestamp: new Date().toISOString(),
  });
};

const readinessHandler = (req, res) => {
  try {
    const currentState = getState();
    const isStateValid = currentState && typeof currentState.fuelLevel === 'number';
    const isCapacityValid = typeof CONSTANTS.TOTAL_FUEL_CAPACITY_L === 'number';

    if (isStateValid && isCapacityValid) {
      return res.status(200).json({
        status: 'ready',
        service: 'antarctic-backend',
        timestamp: new Date().toISOString(),
        components: {
          station_state: true,
          simulation_running: true,
          constants_loaded: true,
        },
      });
    }

    return res.status(503).json({
      status: 'not_ready',
      service: 'antarctic-backend',
      timestamp: new Date().toISOString(),
      components: {
        station_state: isStateValid,
        simulation_running: false,
        constants_loaded: isCapacityValid,
      },
    });
  } catch (err) {
    return res.status(503).json({
      status: 'not_ready',
      error: err.message,
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/health/live', livenessHandler);
app.get('/api/health/live', livenessHandler);
app.get('/health/ready', readinessHandler);
app.get('/api/health/ready', readinessHandler);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Telemetry (Feature 1)
app.use('/api', telemetryRouter);

// Scenarios (Feature 3)
app.use('/api', scenarioRouter);

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  const status = err.status || (err.message && err.message.includes('CORS') ? 403 : 500);
  res.status(status).json({
    error: status === 403 ? 'Forbidden' : 'Internal Server Error',
    message: NODE_ENV === 'production' && status === 500 ? 'An unexpected error occurred' : err.message,
  });
});

// ---------------------------------------------------------------------------
// Process error guards
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WARN] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`[STARTUP] Antarctic backend listening on port ${PORT} (env: ${NODE_ENV})`);
  console.log(`[STARTUP] Allowed CORS origins:`, allowedOrigins);
  console.log(`[STARTUP CHECK] TOTAL_FUEL_CAPACITY_L: ${CONSTANTS.TOTAL_FUEL_CAPACITY_L}`);
  console.log('[STARTUP CHECK] Initial station state:', getState());
  startSimulation();
});

module.exports = { app, server };

