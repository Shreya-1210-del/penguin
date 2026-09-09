// Backend-ready boundary. Replace these functions with REST/WebSocket calls later.
export const telemetryContract = {
  timestamp: "ISO-8601 string",
  ambientTemp: "number",
  fuelLevel: "number",
  burnRate: "number (L/day)",
  survivalDays: "number",
  alertStatus: "OK|WARNING|CRITICAL",
  generatorFailureActive: "boolean",
  activeScenarios: "object ({ blizzard: boolean, generatorFailure: boolean })",
};

export function normalizeTelemetry(input = {}) {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    ambientTemp: Number(input.ambientTemp ?? -20),
    fuelLevel: Number(input.fuelLevel ?? 5000),
    burnRate: Number(input.burnRate ?? 62.5),
    survivalDays: Number(input.survivalDays ?? 80),
    alertStatus: input.alertStatus ?? "OK",
    generatorFailureActive: Boolean(input.generatorFailureActive ?? false),
    activeScenarios: {
      blizzard: Boolean(input.activeScenarios?.blizzard ?? false),
      generatorFailure: Boolean(input.activeScenarios?.generatorFailure ?? false),
    },
  };
}

export async function fetchTelemetry(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
  return normalizeTelemetry(await response.json());
}

export const BACKEND_SSE_URL = "http://localhost:3001/api/telemetry/stream";

export function createSSETelemetry(url, onMessage, onError = () => {}) {
  const source = new EventSource(url);
  source.onmessage = (event) => {
    try {
      const data = normalizeTelemetry(JSON.parse(event.data));
      onMessage(data);
    } catch (err) {
      onError(err);
    }
  };
  source.onerror = (err) => {
    onError(err);
  };
  return source;
}

export function createWebSocketTelemetry(url, onMessage, onError = () => {}) {
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try { onMessage(normalizeTelemetry(JSON.parse(event.data))); } catch (error) { onError(error); }
  };
  socket.onerror = onError;
  return socket;
}

const SCENARIO_API_BASE = "http://localhost:3001/api/scenario";

export async function startBlizzard() {
  const response = await fetch(`${SCENARIO_API_BASE}/blizzard/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Blizzard start failed: ${response.status}`);
  return await response.json();
}

export async function stopBlizzard() {
  const response = await fetch(`${SCENARIO_API_BASE}/blizzard/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Blizzard stop failed: ${response.status}`);
  return await response.json();
}

export async function startGeneratorFailure() {
  const response = await fetch(`${SCENARIO_API_BASE}/generator-failure/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Generator failure start failed: ${response.status}`);
  return await response.json();
}

export async function repairGenerator() {
  const response = await fetch(`${SCENARIO_API_BASE}/generator-failure/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Generator repair failed: ${response.status}`);
  return await response.json();
}

export const triggerBlizzard = startBlizzard;
export const triggerGeneratorFailure = startGeneratorFailure;

export async function resetSimulation() {
  const response = await fetch(`${SCENARIO_API_BASE}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Simulation reset failed: ${response.status}`);
  return await response.json();
}


