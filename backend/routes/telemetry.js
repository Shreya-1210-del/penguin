// routes/telemetry.js — GET /api/telemetry and GET /api/telemetry/stream endpoints
 
const { Router } = require('express');
const { getState, onTick } = require('../stationState');

const router = Router();

/**
 * Format raw state into standardized telemetry schema.
 */
function formatTelemetryPayload(s = getState()) {
  return {
    timestamp: s.lastUpdated,
    ambientTemp: parseFloat(s.ambientTemp.toFixed(2)),
    fuelLevel: parseFloat(s.fuelLevel.toFixed(1)),
    burnRate: parseFloat(s.effectiveBurnRate.toFixed(2)),
    survivalDays: parseFloat(s.survivalDays.toFixed(1)),
    alertStatus: s.alertStatus,
    generatorFailureActive: s.generatorFailureActive,
    activeScenarios: s.activeScenarios ?? {
      blizzard: false,
      generatorFailure: false,
    },
  };
}

// ---------------------------------------------------------------------------
// SSE Clients & Broadcast (Feature 4)
// ---------------------------------------------------------------------------
const sseClients = new Set();

function broadcastTelemetry(payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      console.error('[sse] Write error to client:', err);
      sseClients.delete(client);
    }
  }
}

// Register listener to broadcast on every tick and scenario state change
onTick((updatedState) => {
  broadcastTelemetry(formatTelemetryPayload(updatedState));
});

/**
 * GET /api/telemetry
 * Returns the current station state rounded for readability (REST fallback).
 */
router.get('/telemetry', (req, res, next) => {
  try {
    res.json(formatTelemetryPayload());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/telemetry/stream
 * Server-Sent Events (SSE) stream for live real-time telemetry updates.
 */
router.get('/telemetry/stream', (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial telemetry payload immediately on connect
    const initialPayload = formatTelemetryPayload();
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

