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
    burnRate: Number(input.burnRate ?? input.effectiveBurnRate ?? 62.5),
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
  let response;
  try {
    response = await fetch(endpoint, options);
  } catch (networkError) {
    console.error(`[backendAdapter] Telemetry fetch failed for ${endpoint}:`, networkError);
    throw new Error(`Telemetry unreachable at ${endpoint}. Is the backend running? (${networkError.message})`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  return normalizeTelemetry(data);
}

export const BACKEND_URL =
  (
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  ).replace(/\/$/, "");

export const API_BASE = BACKEND_URL;
export const TELEMETRY_URL = BACKEND_URL ? `${BACKEND_URL}/api/telemetry` : "/api/telemetry";
export const BACKEND_SSE_URL = BACKEND_URL ? `${BACKEND_URL}/api/telemetry/stream` : "/api/telemetry/stream";

export function createSSETelemetry(url, onMessage, onError = () => { }) {
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

export function createWebSocketTelemetry(url, onMessage, onError = () => { }) {
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try { onMessage(normalizeTelemetry(JSON.parse(event.data))); } catch (error) { onError(error); }
  };
  socket.onerror = onError;
  return socket;
}

const SCENARIO_API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/scenario` : "/api/scenario";

/**
 * Generic scenario request with detailed error diagnostics.
 * Calls Express backend via Vite proxy and updates simulation state.
 */
async function scenarioRequest(path, label) {
  const url = `${SCENARIO_API_BASE}${path}`;
  let response;
  try {
    console.log(`[backendAdapter] POST ${url}`);
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (networkError) {
    console.error(`[backendAdapter] Network error on POST ${url}:`, networkError);
    throw new Error(
      `${label}: Cannot reach backend at ${url}. ` +
      `Ensure the backend server is running and accessible. (${networkError.message})`
    );
  }
  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    console.error(`[backendAdapter] ${label} HTTP ${response.status}: ${body}`);
    throw new Error(`${label}: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const data = await response.json();
  console.log(`[backendAdapter] ${label} OK:`, data);
  return data;
}

export async function startBlizzard() {
  return scenarioRequest("/blizzard/start", "Blizzard start");
}

export async function stopBlizzard() {
  return scenarioRequest("/blizzard/stop", "Blizzard stop");
}

export async function startGeneratorFailure() {
  return scenarioRequest("/generator-failure/start", "Generator failure start");
}

export async function repairGenerator() {
  return scenarioRequest("/generator-failure/stop", "Generator repair");
}

export const triggerBlizzard = startBlizzard;
export const triggerGeneratorFailure = startGeneratorFailure;

export async function resetSimulation() {
  return scenarioRequest("/reset", "Simulation reset");
}


