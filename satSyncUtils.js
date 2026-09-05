export function getRawPayload(engineState) {
  const dummySensors = Array.from({ length: 40 }, (_, i) => ({
    id: `SNS_NCPOR_${1000 + i}`,
    value: Number((Math.random() * 100).toFixed(4)),
    frequency: "50Hz",
    voltage: "230.4V",
    status: engineState.generatorStatus === "CRITICAL" && i % 9 === 0 ? "DEGRADED" : "ACTIVE",
    timestamp: new Date().toISOString(),
  }));

  return {
    stationID: "BHARATI_ANTARCTICA_02",
    meta: {
      operator: "NCPOR",
      latitude: "-69.4089",
      longitude: "76.1914",
    },
    telemetry: {
      fuelLevel: Math.round(engineState.currentFuel),
      ambientTemperature: Number(engineState.ambientTemp.toFixed(2)),
      generatorHealth: engineState.generatorStatus,
      burnRate: Number(engineState.actualBurnRate.toFixed(2)),
      survivalDays: Number(engineState.survivalDays.toFixed(2)),
      powerDraw: Number(engineState.powerDraw.toFixed(2)),
    },
    rawSensorGrid: dummySensors,
  };
}

export function getCompressedPayload(engineState) {
  const alert =
    engineState.generatorStatus === "CRITICAL"
      ? "GEN_FAIL"
      : engineState.ambientTemp <= -40
        ? "BLIZZARD"
        : "NOMINAL";

  return JSON.stringify({
    stn: "BHR",
    fuel: Math.round(engineState.currentFuel),
    temp: Number(engineState.ambientTemp.toFixed(1)),
    alrt: alert,
  });
}

export function getPayloadMetrics(engineState) {
  const raw = JSON.stringify(getRawPayload(engineState));
  const compressed = getCompressedPayload(engineState);
  const rawBytes = new TextEncoder().encode(raw).length;
  const compressedBytes = new TextEncoder().encode(compressed).length;
  const reduction = Math.max(0, (1 - compressedBytes / rawBytes) * 100);

  return {
    rawBytes,
    compressedBytes,
    reduction,
    simulatedRawRate: "5.2 MB/s",
    simulatedCompressedRate: "1.8 KB/s",
  };
}