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
    console.log("Body:", text);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const text = await response.text();
  console.log("Body:", text);
  if (!text || text.trim() === "") {
    throw new Error("Backend returned empty response");
  }
  return normalizeTelemetry(JSON.parse(text));
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const BACKEND_URL = API_BASE.replace(/\/$/, "");
export const BACKEND_SSE_URL = `${BACKEND_URL}/api/telemetry/stream`;

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

const SCENARIO_API_BASE = `${BACKEND_URL}/api/scenario`;

/**
 * Generic scenario request with detailed error diagnostics.
 * Wraps fetch so that network failures (TypeError: Failed to fetch)
 * produce an actionable message that includes the exact URL.
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
    // TypeError: Failed to fetch — server unreachable, CORS blocked, DNS failure, etc.
    console.error(`[backendAdapter] Network error on POST ${url}:`, networkError);
    throw new Error(
      `${label}: Cannot reach backend at ${url}. ` +
      `Ensure the backend server is running and accessible. (${networkError.message})`
    );
  }
  if (!response.ok) {
    const text = await response.text();
    console.log("Body:", text);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const text = await response.text();
  console.log("Body:", text);
  if (!text || text.trim() === "") {
    throw new Error("Backend returned empty response");
  }
  const data = JSON.parse(text);
  console.log(`[backendAdapter] ${label} OK:`, data);
  return data;
}

// Local mock state for simulation since FastAPI does not have scenario endpoints
let mockSimulationState = {
  timestamp: new Date().toISOString(),
  ambientTemp: -20,
  fuelLevel: 5000,
  burnRate: 62.5,
  survivalDays: 80,
  alertStatus: "OK",
  generatorFailureActive: false,
  activeScenarios: { blizzard: false, generatorFailure: false }
};

export async function startBlizzard() {
  console.log("[Mock] Start Blizzard");
  mockSimulationState.ambientTemp = -55;
  mockSimulationState.activeScenarios.blizzard = true;
  return { state: mockSimulationState };
}

export async function stopBlizzard() {
  console.log("[Mock] Stop Blizzard");
  mockSimulationState.ambientTemp = -20;
  mockSimulationState.activeScenarios.blizzard = false;
  return { state: mockSimulationState };
}

export async function startGeneratorFailure() {
  console.log("[Mock] Start Generator Failure");
  mockSimulationState.generatorFailureActive = true;
  mockSimulationState.activeScenarios.generatorFailure = true;
  return { state: mockSimulationState };
}

export async function repairGenerator() {
  console.log("[Mock] Repair Generator");
  mockSimulationState.generatorFailureActive = false;
  mockSimulationState.activeScenarios.generatorFailure = false;
  return { state: mockSimulationState };
}

export const triggerBlizzard = startBlizzard;
export const triggerGeneratorFailure = startGeneratorFailure;

export async function resetSimulation() {
  console.log("[Mock] Reset Simulation");
  mockSimulationState = {
    timestamp: new Date().toISOString(),
    ambientTemp: -20,
    fuelLevel: 5000,
    burnRate: 62.5,
    survivalDays: 80,
    alertStatus: "OK",
    generatorFailureActive: false,
    activeScenarios: { blizzard: false, generatorFailure: false }
  };
  return { state: mockSimulationState };
}


