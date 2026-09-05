import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [activeGenerators, setActiveGenerators] = useState(BASE.activeGenerators);
  const [generatorStatus, setGeneratorStatus] = useState(BASE.generatorStatus);
  const [powerLoadKW, setPowerLoadKW] = useState(BASE.powerLoadKW);
  const [scenario, setScenario] = useState(BASE.scenario);
  const [isSatSyncMode, setIsSatSyncMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const recoveryTimer = useRef(null);

  const scenarioPenaltyMultiplier = useMemo(() => {
    let multiplier = 1;
    if (scenario === "BLIZZARD") multiplier *= 1.45;
    if (scenario === "GENERATOR_FAILURE") multiplier *= 2.0;
    if (scenario === "COMBINED") multiplier *= 1.45 * 2.0;
    return multiplier;
  }, [scenario]);

  const multiplier = useMemo(() => coldMultiplier(ambientTemp), [ambientTemp]);
  const actualBurnRate = useMemo(() => calculateBurnRate({ ambientTemperature: ambientTemp, activeGenerators, scenarioPenaltyMultiplier }), [ambientTemp, activeGenerators, scenarioPenaltyMultiplier]);
  const dailyBurnRate = actualBurnRate * 24;
  const survivalDays = useMemo(() => calculateSurvivalDays({ totalRemainingFuelLiters: currentFuel, actualBurnRate }), [currentFuel, actualBurnRate]);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setAmbientTemp(previous => {
        if (scenario === "BLIZZARD" || scenario === "COMBINED") return -55;
        if (scenario === "GENERATOR_FAILURE") return clamp(previous + (BASE.ambientTemp - previous) * 0.16 + (Math.random() - 0.5) * 0.5, -55, -20);
        return clamp(previous + (BASE.ambientTemp - previous) * 0.12 + (Math.random() - 0.5) * 0.7, -33, -20);
      });
      setCurrentFuel(previous => Math.max(0, previous - actualBurnRate / 1200));
      setPowerLoadKW(previous => {
        const target = scenario === "BLIZZARD" || scenario === "COMBINED" ? 310 : scenario === "GENERATOR_FAILURE" ? 115 : 182;
        return clamp(previous + (target - previous) * 0.13 + (Math.random() - 0.5) * 7, 70, 330);
      });
      setHistory(previous => [...previous.slice(-29), { time: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }), temperature: Number(ambientTemp.toFixed(1)), fuel: Math.round(currentFuel), burnRate: Number(dailyBurnRate.toFixed(1)), power: Number(powerLoadKW.toFixed(1)), efficiency: Number(efficiencyIndex.toFixed(1)) }]);
    }, 3000);
    return () => clearInterval(timer);
  }, [actualBurnRate, ambientTemp, currentFuel, dailyBurnRate, efficiencyIndex, powerLoadKW, scenario]);

  useEffect(() => {
    if (survivalDays < 15) addLog("CRITICAL_FUEL_WARN: Survival window below 15 days.", "danger");
  }, [survivalDays, addLog]);

  useEffect(() => {
    if (efficiencyIndex > 92) addLog("OVERLOAD_WARNING: Efficiency index above 92%.", "warning");
    else if (efficiencyIndex < 40) addLog("INEFFICIENT_RUN_WARNING: Efficiency index below 40%.", "warning");
  }, [efficiencyIndex, addLog]);

  const triggerBlizzard = useCallback(() => {
    setAmbientTemp(-55);
    setScenario(generatorStatus === "CRITICAL" ? "COMBINED" : "BLIZZARD");
    addLog("WARNING: Blizzard Level 5 simulated. Ambient temperature → -55°C; HVAC penalty → 1.45×.", "warning");
  }, [addLog, generatorStatus]);

  const triggerGeneratorFailure = useCallback(() => {
    setGeneratorStatus("CRITICAL");
    setActiveGenerators(1);
    setScenario(ambientTemp <= -45 ? "COMBINED" : "GENERATOR_FAILURE");
    addLog("CRITICAL: Primary generator failure simulated. Active units reduced from 3 to 1; failure penalty → 2.0×.", "danger");
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    recoveryTimer.current = setTimeout(() => {
      setGeneratorStatus("NORMAL");
      setActiveGenerators(BASE_ACTIVE_GENERATORS);
      setScenario(ambientTemp <= -45 ? "BLIZZARD" : "NORMAL");
      addLog("RECOVERY: Generator fleet returned to nominal configuration.", "success");
    }, 10000);
  }, [addLog, ambientTemp]);

  const resetSystem = useCallback(() => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    setCurrentFuel(BASE_FUEL_LITERS);
    setAmbientTemp(BASE.ambientTemp);
    setActiveGenerators(BASE_ACTIVE_GENERATORS);
    setGeneratorStatus(BASE.generatorStatus);
    setPowerLoadKW(BASE.powerLoadKW);
    setScenario(BASE.scenario);
    setHistory([]);
    addLog("SYSTEM RESET: Mock station returned to baseline parameters.", "info");
  }, [addLog]);

  useEffect(() => () => recoveryTimer.current && clearTimeout(recoveryTimer.current), []);

  return {
    fuelTankCapacity: BASE_FUEL_LITERS,
    tankCount: TANK_COUNT,
    baseBurnRatePerGenerator: BASE_BURN_LPH_PER_GENERATOR,
    currentFuel, ambientTemp, activeGenerators, generatorStatus, powerLoadKW, powerDraw: (powerLoadKW / Math.max(1, activeGenerators * MAX_KW_PER_GENERATOR)) * 100,
    scenario, scenarioPenaltyMultiplier, coldMultiplier: multiplier, viscosityRisk,
    actualBurnRate, dailyBurnRate, survivalDays, efficiencyIndex,
    isSatSyncMode, setIsSatSyncMode, history, logs,
    triggerBlizzard, triggerGeneratorFailure, resetSystem,
  };
}
