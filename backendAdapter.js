// Backend-ready boundary. Replace these functions with REST/WebSocket calls later.
export const telemetryContract = {
  stationId: "string",
  ambientTemp: "number",
  fuelLevel: "number",
  generatorStatus: "ok|warning|critical",
  powerDraw: "number",
  burnRate: "number",
  timestamp: "ISO-8601 string",
};

export function normalizeTelemetry(input = {}) {
  return {
    stationId: input.stationId ?? "BHARATI_ANTARCTICA_02",
    ambientTemp: Number(input.ambientTemp ?? -25),
    fuelLevel: Number(input.fuelLevel ?? 380000),
    generatorStatus: input.generatorStatus ?? "ok",
    powerDraw: Number(input.powerDraw ?? 62),
    burnRate: Number(input.burnRate ?? 1200),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export async function fetchTelemetry(endpoint, options) {
  const response = await fetch(endpoint, options);
  if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
  return normalizeTelemetry(await response.json());
}

export function createWebSocketTelemetry(url, onMessage, onError = () => {}) {
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try { onMessage(normalizeTelemetry(JSON.parse(event.data))); } catch (error) { onError(error); }
  };
  socket.onerror = onError;
  return socket;
}
