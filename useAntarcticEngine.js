import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTelemetry,
  normalizeTelemetry,
  BACKEND_SSE_URL,
  startBlizzard as apiStartBlizzard,
  stopBlizzard as apiStopBlizzard,
  startGeneratorFailure as apiStartGenFailure,
  repairGenerator as apiRepairGenerator,
  resetSimulation as apiResetSimulation,
} from "./backendAdapter.js";

const BACKEND_TELEMETRY_URL = "http://localhost:3001/api/telemetry";
const BACKEND_POLL_MS = 2000;

export const BASE_FUEL_LITERS = 120000;
export const TANK_COUNT = 4;
export const BASE_BURN_LPH_PER_GENERATOR = 45;
export const BASE_ACTIVE_GENERATORS = 3;
export const MAX_KW_PER_GENERATOR = 120;

const BASE = { ambientTemp: -25, activeGenerators: BASE_ACTIVE_GENERATORS, generatorStatus: "NORMAL", powerLoadKW: 182, scenario: "NORMAL" };
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function coldMultiplier(ambientTemperature) {
  return ambientTemperature < -20 ? 1 + (Math.abs(ambientTemperature) - 20) * 0.018 : 1;
}

export function calculateBurnRate({ ambientTemperature, activeGenerators, scenarioPenaltyMultiplier = 1 }) {
  return BASE_BURN_LPH_PER_GENERATOR * activeGenerators * coldMultiplier(ambientTemperature) * scenarioPenaltyMultiplier;
}

export function calculateSurvivalDays({ totalRemainingFuelLiters, actualBurnRate }) {
  return actualBurnRate > 0 ? totalRemainingFuelLiters / (actualBurnRate * 24) : 0;
}

export function useAntarcticEngine() {
  const [currentFuel, setCurrentFuel] = useState(BASE_FUEL_LITERS);
  const [ambientTemp, setAmbientTemp] = useState(BASE.ambientTemp);
  const [generatorFailureActive, setGeneratorFailureActive] = useState(false);
  const [activeScenarios, setActiveScenarios] = useState({ blizzard: false, generatorFailure: false });
  const [powerLoadKW, setPowerLoadKW] = useState(BASE.powerLoadKW);
  const [isSatSyncMode, setIsSatSyncMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alertStatus, setAlertStatus] = useState("OK");
  const [backendConnected, setBackendConnected] = useState(true);
  const [backendBurnRate, setBackendBurnRate] = useState(62.5);
  const [backendSurvivalDays, setBackendSurvivalDays] = useState(80);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState("");
  const [scenarioError, setScenarioError] = useState(null);

  const activeGenerators = generatorFailureActive ? 1 : BASE_ACTIVE_GENERATORS;
  const generatorStatus = generatorFailureActive ? "CRITICAL" : "NORMAL";

  const scenario = useMemo(() => {
    if (generatorFailureActive && ambientTemp <= -40) return "COMBINED";
    if (generatorFailureActive) return "GENERATOR_FAILURE";
    if (ambientTemp <= -35) return "BLIZZARD";
    return "NORMAL";
  }, [generatorFailureActive, ambientTemp]);


  const scenarioPenaltyMultiplier = useMemo(() => {
    let multiplier = 1;
    if (scenario === "BLIZZARD") multiplier *= 1.45;
    if (scenario === "GENERATOR_FAILURE") multiplier *= 2.0;
    if (scenario === "COMBINED") multiplier *= 1.45 * 2.0;
    return multiplier;
  }, [scenario]);

  const multiplier = useMemo(() => coldMultiplier(ambientTemp), [ambientTemp]);
  // burnRate, survivalDays, and dailyBurnRate now come from backend polling
  const dailyBurnRate = backendBurnRate;
  const actualBurnRate = backendBurnRate / 24;
  const survivalDays = backendSurvivalDays;
  const efficiencyIndex = useMemo(() => {
    const raw = (powerLoadKW / Math.max(1, activeGenerators * MAX_KW_PER_GENERATOR)) * 100;
    if (ambientTemp < -35) return raw * (1 - (Math.abs(ambientTemp) - 35) * 0.005);
    return raw;
  }, [powerLoadKW, activeGenerators, ambientTemp]);
  const viscosityRisk = ambientTemp < -45;

  const addLog = useCallback((message, type = "info") => {
    setLogs(prev => [{ id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), message, type }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    addLog("SYSTEM: Penguin digital twin link established.", "success");
    addLog("TELEMETRY: Mock station stream initialized.", "info");
  }, [addLog]);

  const backendConnectedRef = useRef(backendConnected);
  useEffect(() => {
    backendConnectedRef.current = backendConnected;
  }, [backendConnected]);

  const powerLoadRef = useRef(BASE.powerLoadKW);

  // Central telemetry state applicator
  const applyTelemetryUpdate = useCallback((data) => {
    setAmbientTemp(data.ambientTemp);
    setCurrentFuel(data.fuelLevel);
    setBackendBurnRate(data.burnRate);
    setBackendSurvivalDays(data.survivalDays);
    setAlertStatus(data.alertStatus);
    setGeneratorFailureActive(Boolean(data.generatorFailureActive));
    if (data.activeScenarios) {
      setActiveScenarios(data.activeScenarios);
    }

    const isBlizzard = Boolean(data.activeScenarios?.blizzard || data.ambientTemp <= -35);
    const isGenFailure = Boolean(data.activeScenarios?.generatorFailure || data.generatorFailureActive);
    let currentScenario = "NORMAL";
    if (isGenFailure && (isBlizzard || data.ambientTemp <= -40)) {
      currentScenario = "COMBINED";
    } else if (isGenFailure) {
      currentScenario = "GENERATOR_FAILURE";
    } else if (isBlizzard) {
      currentScenario = "BLIZZARD";
    }

    const activeGens = isGenFailure ? 1 : BASE_ACTIVE_GENERATORS;
    const targetLoad = (currentScenario === "BLIZZARD" || currentScenario === "COMBINED") ? 310 : (currentScenario === "GENERATOR_FAILURE" ? 115 : 182);

    const prevLoad = powerLoadRef.current;
    const nextPowerLoad = clamp(prevLoad + (targetLoad - prevLoad) * 0.15 + (Math.random() - 0.5) * 8, 70, 330);
    powerLoadRef.current = nextPowerLoad;
    setPowerLoadKW(nextPowerLoad);

    const nextPowerDraw = (nextPowerLoad / Math.max(1, activeGens * MAX_KW_PER_GENERATOR)) * 100;
    const rawEff = nextPowerDraw;
    const nextEff = data.ambientTemp < -35 ? rawEff * (1 - (Math.abs(data.ambientTemp) - 35) * 0.005) : rawEff;

    const timeStr = new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
    const newPoint = {
      time: timeStr,
      ambientTemp: Number(data.ambientTemp.toFixed(1)),
      temperature: Number(data.ambientTemp.toFixed(1)),
      burnRate: Number(data.burnRate.toFixed(1)),
      fuelLevel: Math.round(data.fuelLevel),
      fuel: Math.round(data.fuelLevel),
      survivalDays: Number(data.survivalDays.toFixed(1)),
      powerDraw: Number(nextPowerDraw.toFixed(1)),
      power: Number(nextPowerDraw.toFixed(1)),
      powerLoadKW: Number(nextPowerLoad.toFixed(1)),
      efficiency: Number(nextEff.toFixed(1)),
    };

    setHistory((prev) => [...prev.slice(-29), newPoint]);
  }, []);

  // REST fallback polling function
  const pollTelemetry = useCallback(async () => {
    try {
      const data = await fetchTelemetry(BACKEND_TELEMETRY_URL);
      applyTelemetryUpdate(data);
      if (!backendConnectedRef.current) {
        addLog("SYSTEM: Backend connection restored (HTTP polling).", "success");
      }
      setBackendConnected(true);
      return data;
    } catch (error) {
      if (backendConnectedRef.current) {
        addLog("ERROR: Cannot reach backend telemetry endpoint.", "danger");
      }
      setBackendConnected(false);
      throw error;
    }
  }, [addLog, applyTelemetryUpdate]);

  // Primary SSE telemetry connection with automatic 2-second HTTP polling fallback
  useEffect(() => {
    let sseSource = null;
    let fallbackInterval = null;
    let isCancelled = false;

    const startFallbackPolling = () => {
      if (fallbackInterval || isCancelled) return;
      addLog("WARNING: SSE stream unavailable. Falling back to HTTP polling (2s).", "warning");
      pollTelemetry().catch(() => {});
      fallbackInterval = setInterval(() => {
        pollTelemetry().catch(() => {});
      }, BACKEND_POLL_MS);
    };

    const stopFallbackPolling = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const connectSSE = () => {
      try {
        sseSource = new EventSource(BACKEND_SSE_URL);

        sseSource.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const data = normalizeTelemetry(JSON.parse(event.data));
            applyTelemetryUpdate(data);
            if (!backendConnectedRef.current) {
              addLog("SYSTEM: Real-time SSE telemetry stream connected.", "success");
            }
            setBackendConnected(true);
            stopFallbackPolling();
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };

        sseSource.onerror = () => {
          if (isCancelled) return;
          startFallbackPolling();
        };
      } catch (err) {
        console.error("SSE connection error:", err);
        startFallbackPolling();
      }
    };

    connectSSE();

    return () => {
      isCancelled = true;
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }
      stopFallbackPolling();
    };
  }, [applyTelemetryUpdate, pollTelemetry, addLog]);

  useEffect(() => {
    if (survivalDays < 15) addLog("CRITICAL_FUEL_WARN: Survival window below 15 days.", "danger");
  }, [survivalDays, addLog]);

  useEffect(() => {
    if (efficiencyIndex > 92) addLog("OVERLOAD_WARNING: Efficiency index above 92%.", "warning");
    else if (efficiencyIndex < 40) addLog("INEFFICIENT_RUN_WARNING: Efficiency index below 40%.", "warning");
  }, [efficiencyIndex, addLog]);

  const startBlizzard = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiStartBlizzard();
      setScenarioMessage("Blizzard Activated");
      addLog("SCENARIO: Blizzard Level 5 (-55°C) started on backend.", "warning");
      await pollTelemetry().catch(() => {});
      return res;
    } catch (err) {
      setScenarioError(err.message);
      addLog(`ERROR: Blizzard start failed: ${err.message}`, "danger");
      throw err;
    } finally {
      setScenarioLoading(false);
    }
  }, [addLog, pollTelemetry]);

  const stopBlizzard = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiStopBlizzard();
      setScenarioMessage("Blizzard Stopped");
      addLog("SCENARIO: Blizzard stopped on backend. Temperature returning to baseline.", "success");
      await pollTelemetry().catch(() => {});
      return res;
    } catch (err) {
      setScenarioError(err.message);
      addLog(`ERROR: Blizzard stop failed: ${err.message}`, "danger");
      throw err;
    } finally {
      setScenarioLoading(false);
    }
  }, [addLog, pollTelemetry]);

  const toggleBlizzard = useCallback(async () => {
    if (activeScenarios.blizzard) {
      return await stopBlizzard();
    } else {
      return await startBlizzard();
    }
  }, [activeScenarios.blizzard, startBlizzard, stopBlizzard]);

  const startGeneratorFailure = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiStartGenFailure();
      setScenarioMessage("Generator Failure Activated");
      addLog("SCENARIO: Primary generator failure activated on backend (1.5x burn rate).", "danger");
      await pollTelemetry().catch(() => {});
      return res;
    } catch (err) {
      setScenarioError(err.message);
      addLog(`ERROR: Generator failure start failed: ${err.message}`, "danger");
      throw err;
    } finally {
      setScenarioLoading(false);
    }
  }, [addLog, pollTelemetry]);

  const repairGenerator = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiRepairGenerator();
      setScenarioMessage("Generator Repaired");
      addLog("SCENARIO: Primary generator repaired on backend. Fleet nominal.", "success");
      await pollTelemetry().catch(() => {});
      return res;
    } catch (err) {
      setScenarioError(err.message);
      addLog(`ERROR: Generator repair failed: ${err.message}`, "danger");
      throw err;
    } finally {
      setScenarioLoading(false);
    }
  }, [addLog, pollTelemetry]);

  const toggleGeneratorFailure = useCallback(async () => {
    if (activeScenarios.generatorFailure) {
      return await repairGenerator();
    } else {
      return await startGeneratorFailure();
    }
  }, [activeScenarios.generatorFailure, startGeneratorFailure, repairGenerator]);

  const resetSimulation = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiResetSimulation();
      setScenarioMessage("Simulation Reset");
      powerLoadRef.current = BASE.powerLoadKW;
      setPowerLoadKW(BASE.powerLoadKW);
      setHistory([]);
      addLog("SYSTEM RESET: Station parameters restored to baseline on backend.", "info");
      await pollTelemetry().catch(() => {});
      return res;
    } catch (err) {
      setScenarioError(err.message);
      addLog(`ERROR: Simulation reset failed: ${err.message}`, "danger");
      throw err;
    } finally {
      setScenarioLoading(false);
    }
  }, [addLog, pollTelemetry]);

  return {
    fuelTankCapacity: BASE_FUEL_LITERS,
    tankCount: TANK_COUNT,
    baseBurnRatePerGenerator: BASE_BURN_LPH_PER_GENERATOR,
    currentFuel, ambientTemp, activeGenerators, generatorStatus, powerLoadKW, powerDraw: (powerLoadKW / Math.max(1, activeGenerators * MAX_KW_PER_GENERATOR)) * 100,
    scenario, scenarioPenaltyMultiplier, coldMultiplier: multiplier, viscosityRisk,
    actualBurnRate, dailyBurnRate, survivalDays, efficiencyIndex,
    isSatSyncMode, setIsSatSyncMode, history, logs, addLog,
    activeScenarios,
    startBlizzard, stopBlizzard, triggerBlizzard: startBlizzard, toggleBlizzard,
    startGeneratorFailure, repairGenerator, triggerGeneratorFailure: startGeneratorFailure, toggleGeneratorFailure,
    resetSystem: resetSimulation, resetSimulation,
    alertStatus, backendConnected, generatorFailureActive,
    scenarioLoading, scenarioMessage, scenarioError,
    loading: scenarioLoading, error: scenarioError,
  };
}
