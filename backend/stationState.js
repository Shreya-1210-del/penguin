// stationState.js — simulation engine for Antarctic station fuel consumption

const {
  TOTAL_FUEL_CAPACITY_L,
  BASE_BURN_RATE_L_PER_DAY,
  T_TARGET_C,
  K_COEFFICIENT,
  GENERATOR_FAILURE_MULTIPLIER,
  OU_MU_BASE_C,
  OU_THETA,
  OU_SIGMA,
  OU_DELTA_T,
  TEMP_MIN_C,
  TEMP_MAX_C,
  TICK_INTERVAL_MS,
  SIMULATED_HOURS_PER_TICK,
  ALERT_THRESHOLD_WARNING_DAYS,
  ALERT_THRESHOLD_CRITICAL_DAYS,
} = require('./constants');

// ---------------------------------------------------------------------------
// In-memory station state
// ---------------------------------------------------------------------------
const state = {
  ambientTemp: OU_MU_BASE_C,            // current ambient temperature (°C)
  currentMeanTemp: OU_MU_BASE_C,        // OU process target mean — Feature 3 may shift this during blizzards
  fuelLevel: TOTAL_FUEL_CAPACITY_L,     // remaining fuel (litres)
  generatorFailureActive: false,        // true when generator failure scenario is active
  effectiveBurnRate: BASE_BURN_RATE_L_PER_DAY, // most recent effective burn rate (L/day)
  survivalDays: TOTAL_FUEL_CAPACITY_L / BASE_BURN_RATE_L_PER_DAY,
  alertStatus: 'OK',
  activeScenarios: {
    blizzard: false,
    generatorFailure: false,
  },
  lastUpdated: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Gaussian RNG — Box-Muller transform
// ---------------------------------------------------------------------------
/**
 * Returns a sample from the standard normal distribution N(0, 1)
 * using the Box-Muller transform applied to two uniform samples.
 */
function sampleStandardNormal() {
  let u1 = 0;
  let u2 = 0;
  // Reject exact-zero to avoid log(0)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// Tick & Scenario Listeners (for SSE Broadcast - Feature 4)
// ---------------------------------------------------------------------------
const tickListeners = new Set();

/**
 * Registers a listener to be called whenever the simulation state updates.
 * @param {Function} listener callback receiving current state
 * @returns {Function} unregister function
 */
function onTick(listener) {
  tickListeners.add(listener);
  return () => tickListeners.delete(listener);
}

function notifyListeners() {
  const current = getState();
  for (const listener of tickListeners) {
    try {
      listener(current);
    } catch (err) {
      console.error('[sim] Error in tick listener:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Simulation tick
// ---------------------------------------------------------------------------
/**
 * Advance the simulation by one tick.  Follows Formulas 1, 2, 4, 6 from the
 * spec in the exact order prescribed.
 */
function tick() {
  // (a) Ambient temperature update — Ornstein-Uhlenbeck process (Formula 4)
  let nextTemp =
    state.ambientTemp +
    OU_THETA * (state.currentMeanTemp - state.ambientTemp) * OU_DELTA_T +
    OU_SIGMA * Math.sqrt(OU_DELTA_T) * sampleStandardNormal();

  // Clamp to allowed range
  nextTemp = Math.max(TEMP_MIN_C, Math.min(TEMP_MAX_C, nextTemp));

  // (b) Thermal burn rate (Formula 1)
  const thermalBurnRate =
    BASE_BURN_RATE_L_PER_DAY + K_COEFFICIENT * Math.max(0, T_TARGET_C - nextTemp);

  // (c) Apply generator failure penalty
  const effectiveBurnRate =
    thermalBurnRate * (state.generatorFailureActive ? GENERATOR_FAILURE_MULTIPLIER : 1);

  // (d) Fuel depletion — convert daily rate to per-tick amount
  const simulatedDaysPerTick = SIMULATED_HOURS_PER_TICK / 24;
  let nextFuelLevel = Math.max(
    0,
    state.fuelLevel - effectiveBurnRate * simulatedDaysPerTick,
  );

  // Auto-resupply when fuel exhausts so continuous simulation loop does not stall at 0
  if (nextFuelLevel <= 0) {
    nextFuelLevel = TOTAL_FUEL_CAPACITY_L;
  }

  // (e) Survival days (Formula 2)
  const survivalDays =
    effectiveBurnRate > 0 ? nextFuelLevel / effectiveBurnRate : Infinity;

  // (f) Alert status (Formula 6)
  let alertStatus = 'OK';
  if (survivalDays < ALERT_THRESHOLD_CRITICAL_DAYS) {
    alertStatus = 'CRITICAL';
  } else if (survivalDays < ALERT_THRESHOLD_WARNING_DAYS) {
    alertStatus = 'WARNING';
  }

  // Commit to state
  state.ambientTemp = nextTemp;
  state.fuelLevel = nextFuelLevel;
  state.effectiveBurnRate = effectiveBurnRate;
  state.survivalDays = survivalDays;
  state.alertStatus = alertStatus;
  state.lastUpdated = new Date().toISOString();

  // Broadcast to SSE listeners
  notifyListeners();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Returns a shallow copy of the current station state.
 */
function getState() {
  return {
    ...state,
    burnRate: parseFloat(state.effectiveBurnRate.toFixed(2)),
    activeScenarios: { ...state.activeScenarios },
  };
}

let simulationInterval = null;

/**
 * Starts the simulation tick loop.
 * @returns {NodeJS.Timeout} interval handle (can be used to stop the loop)
 */
function startSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  console.log('[sim] Simulation started — tick every %d ms', TICK_INTERVAL_MS);
  simulationInterval = setInterval(tick, TICK_INTERVAL_MS);
  return simulationInterval;
}

/**
 * Stops the simulation tick loop.
 */
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('[sim] Simulation stopped');
  }
}

// ---------------------------------------------------------------------------
// Scenario Lifecycle Controls
// ---------------------------------------------------------------------------

/**
 * Synchronously recalculates effective burn rate, survival days, and alert status
 * for the current station conditions (called immediately on scenario trigger/stop).
 */
function recalculatePhysics() {
  const thermalBurnRate =
    BASE_BURN_RATE_L_PER_DAY + K_COEFFICIENT * Math.max(0, T_TARGET_C - state.ambientTemp);
  const effectiveBurnRate =
    thermalBurnRate * (state.generatorFailureActive ? GENERATOR_FAILURE_MULTIPLIER : 1);
  const survivalDays =
    effectiveBurnRate > 0 ? state.fuelLevel / effectiveBurnRate : Infinity;
  let alertStatus = 'OK';
  if (survivalDays < ALERT_THRESHOLD_CRITICAL_DAYS) {
    alertStatus = 'CRITICAL';
  } else if (survivalDays < ALERT_THRESHOLD_WARNING_DAYS) {
    alertStatus = 'WARNING';
  }

  state.effectiveBurnRate = effectiveBurnRate;
  state.survivalDays = survivalDays;
  state.alertStatus = alertStatus;
}

/**
 * Activates a blizzard: shifts OU mean to -55 °C and sets activeScenarios.blizzard = true.
 */
function startBlizzard() {
  state.activeScenarios.blizzard = true;
  state.currentMeanTemp = -55;
  state.ambientTemp = -55;
  recalculatePhysics();
  state.lastUpdated = new Date().toISOString();
  notifyListeners();
}

/**
 * Stops the blizzard: restores OU mean to -20 °C and sets activeScenarios.blizzard = false.
 * Fuel is preserved.
 */
function stopBlizzard() {
  state.activeScenarios.blizzard = false;
  state.currentMeanTemp = OU_MU_BASE_C;
  state.ambientTemp = OU_MU_BASE_C;
  recalculatePhysics();
  state.lastUpdated = new Date().toISOString();
  notifyListeners();
}

/**
 * Activates generator failure: applies 1.5× burn-rate multiplier and sets activeScenarios.generatorFailure = true.
 */
function startGeneratorFailure() {
  state.activeScenarios.generatorFailure = true;
  state.generatorFailureActive = true;
  recalculatePhysics();
  state.lastUpdated = new Date().toISOString();
  notifyListeners();
}

/**
 * Repairs the generator: clears failure multiplier and sets activeScenarios.generatorFailure = false.
 * Fuel is preserved.
 */
function repairGenerator() {
  state.activeScenarios.generatorFailure = false;
  state.generatorFailureActive = false;
  recalculatePhysics();
  state.lastUpdated = new Date().toISOString();
  notifyListeners();
}

/**
 * Resets all simulation state to fresh-start baseline conditions.
 */
function resetSimulation() {
  state.activeScenarios.blizzard = false;
  state.activeScenarios.generatorFailure = false;
  state.currentMeanTemp = OU_MU_BASE_C;
  state.generatorFailureActive = false;
  state.ambientTemp = OU_MU_BASE_C;
  state.fuelLevel = TOTAL_FUEL_CAPACITY_L;
  state.effectiveBurnRate = BASE_BURN_RATE_L_PER_DAY;
  state.survivalDays = TOTAL_FUEL_CAPACITY_L / BASE_BURN_RATE_L_PER_DAY;
  state.alertStatus = 'OK';
  state.lastUpdated = new Date().toISOString();
  notifyListeners();
}

module.exports = {
  getState,
  startSimulation,
  stopSimulation,
  onTick,
  startBlizzard,
  stopBlizzard,
  triggerBlizzard: startBlizzard,
  startGeneratorFailure,
  repairGenerator,
  triggerGeneratorFailure: startGeneratorFailure,
  resetSimulation,
};
