// predictiveUtils.js — Pure forecasting functions for Antarctic Digital Twin
// No React hooks. No UI logic. Pure calculations only.

// ─────────────────────────────────────────────────────────────
// Backend simulation constants (mirrored from constants.js)
// ─────────────────────────────────────────────────────────────
export const SIM_CONSTANTS = {
  BASE_BURN_RATE_L_PER_DAY: 62.5,
  T_TARGET_C: -25,
  K_COEFFICIENT: 3,
  GENERATOR_FAILURE_MULTIPLIER: 1.5,
  BLIZZARD_TEMP_C: -55,
  SIMULATED_HOURS_PER_TICK: 6,
  INTERVAL_DAYS_PER_TICK: 0.25, // 6 hours = 0.25 day
  ALERT_THRESHOLD_WARNING_DAYS: 30,
  ALERT_THRESHOLD_CRITICAL_DAYS: 10,
};

// ─────────────────────────────────────────────────────────────
// REGRESSION TREND ANALYSIS
// ─────────────────────────────────────────────────────────────
/**
 * Calculates a linear regression trend over fuel history.
 * Uses the corrected time model: 1 tick = 0.25 simulated day.
 *
 * @param {Array<{fuel: number}>} history — rolling telemetry history
 * @returns {{ slope: number, days: number, confidence: number }}
 */
export function calculateRegressionTrend(history) {
  if (!history || history.length < 3) {
    return { slope: 0, days: 0, confidence: 0 };
  }

  const ys = history.map((p) => p.fuel ?? p.fuelLevel ?? 0);
  const n = ys.length;
  const xs = ys.map((_, i) => i);

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  const denom = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / denom;

  // Corrected time model: each tick = 0.25 simulated days
  const intervalDays = SIM_CONSTANTS.INTERVAL_DAYS_PER_TICK;
  const dailyLoss = Math.max(0.01, Math.abs(slope) / intervalDays);
  const currentFuel = ys[ys.length - 1];
  const days = currentFuel / dailyLoss;

  const confidence = Math.min(99, Math.round(55 + n * 2.1));

  return { slope, days, confidence };
}

// ─────────────────────────────────────────────────────────────
// FUEL FORECAST
// ─────────────────────────────────────────────────────────────
/**
 * Forecasts fuel levels at Day 7, Day 14, and Day 30.
 *
 * @param {number} currentFuel — current fuel level in litres
 * @param {number} burnRate — daily burn rate in L/day
 * @returns {{ today: number, day7: number, day14: number, day30: number }}
 */
export function calculateFuelForecast(currentFuel, burnRate) {
  const safeBurn = Math.max(burnRate, 0);
  return {
    today: Math.max(0, currentFuel),
    day7: Math.max(0, currentFuel - safeBurn * 7),
    day14: Math.max(0, currentFuel - safeBurn * 14),
    day30: Math.max(0, currentFuel - safeBurn * 30),
  };
}

// ─────────────────────────────────────────────────────────────
// DEPLETION FORECAST
// ─────────────────────────────────────────────────────────────
/**
 * Forecasts depletion using the physical simulation model.
 * Does NOT use regression as primary predictor.
 *
 * @param {number} currentFuel — current fuel level in litres
 * @param {number} burnRate — daily burn rate in L/day
 * @returns {{ daysRemaining: number, projectedDate: string }}
 */
export function calculateDepletionForecast(currentFuel, burnRate) {
  const daysRemaining = currentFuel / Math.max(burnRate, 1);
  const projectedDate = new Date(
    Date.now() + Math.max(0, daysRemaining) * 86400000
  );

  return {
    daysRemaining,
    projectedDate: projectedDate.toLocaleDateString(),
  };
}

// ─────────────────────────────────────────────────────────────
// RISK FORECAST
// ─────────────────────────────────────────────────────────────
/**
 * Calculates when WARNING (30 days) and CRITICAL (10 days) thresholds
 * will be reached at the current burn rate.
 *
 * @param {number} currentFuel — current fuel level in litres
 * @param {number} burnRate — daily burn rate in L/day
 * @returns {{ daysUntilWarning: number, daysUntilCritical: number }}
 */
export function calculateRiskForecast(currentFuel, burnRate) {
  const safeBurn = Math.max(burnRate, 1);
  const daysRemaining = currentFuel / safeBurn;

  const {
    ALERT_THRESHOLD_WARNING_DAYS,
    ALERT_THRESHOLD_CRITICAL_DAYS,
  } = SIM_CONSTANTS;

  // Fuel level when we would have exactly WARNING_DAYS remaining
  const fuelAtWarning = safeBurn * ALERT_THRESHOLD_WARNING_DAYS;
  // Fuel level when we would have exactly CRITICAL_DAYS remaining
  const fuelAtCritical = safeBurn * ALERT_THRESHOLD_CRITICAL_DAYS;

  // How many days of burn until we reach those fuel levels
  const daysUntilWarning = Math.max(
    0,
    (currentFuel - fuelAtWarning) / safeBurn
  );
  const daysUntilCritical = Math.max(
    0,
    (currentFuel - fuelAtCritical) / safeBurn
  );

  return {
    daysUntilWarning,
    daysUntilCritical,
    currentDaysRemaining: daysRemaining,
  };
}

// ─────────────────────────────────────────────────────────────
// SCENARIO IMPACT FORECAST
// ─────────────────────────────────────────────────────────────
/**
 * Forecasts survival days under each scenario, matching backend formulas.
 *
 * @param {number} currentFuel — current fuel level in litres
 * @param {number} burnRate — current daily burn rate in L/day
 * @returns {{ normal: number, blizzard: number, generatorFailure: number, combined: number }}
 */
export function calculateScenarioForecast(currentFuel, burnRate) {
  const {
    BASE_BURN_RATE_L_PER_DAY,
    T_TARGET_C,
    K_COEFFICIENT,
    GENERATOR_FAILURE_MULTIPLIER,
    BLIZZARD_TEMP_C,
  } = SIM_CONSTANTS;

  // Normal: use current burn rate
  const normalDays = currentFuel / Math.max(burnRate, 1);

  // Blizzard: base burn + thermal penalty from -55°C
  const blizzardBurnRate =
    BASE_BURN_RATE_L_PER_DAY +
    K_COEFFICIENT * Math.max(0, T_TARGET_C - BLIZZARD_TEMP_C);
  const blizzardDays = currentFuel / Math.max(blizzardBurnRate, 1);

  // Generator failure: current burn * 1.5
  const generatorFailureBurnRate = burnRate * GENERATOR_FAILURE_MULTIPLIER;
  const generatorFailureDays =
    currentFuel / Math.max(generatorFailureBurnRate, 1);

  // Combined: blizzard burn * 1.5
  const combinedBurnRate = blizzardBurnRate * GENERATOR_FAILURE_MULTIPLIER;
  const combinedDays = currentFuel / Math.max(combinedBurnRate, 1);

  return {
    normal: normalDays,
    blizzard: blizzardDays,
    generatorFailure: generatorFailureDays,
    combined: combinedDays,
  };
}
