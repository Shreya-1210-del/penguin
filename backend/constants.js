// constants.js — simulation parameters for Antarctic station fuel model

const CONSTANTS = {
  TOTAL_FUEL_CAPACITY_L: 5000,                // maximum fuel tank capacity in litres
  BASE_BURN_RATE_L_PER_DAY: 62.5,             // baseline fuel burn rate in litres per day
  T_TARGET_C: -25,                             // target interior temperature in °C
  K_COEFFICIENT: 3,                            // thermal sensitivity coefficient (L/day per °C below target)
  GENERATOR_FAILURE_MULTIPLIER: 1.5,           // burn-rate multiplier when generator is in failure mode
  OU_MU_BASE_C: -20,                           // baseline mean ambient temperature (°C) — OU long-term mean
  OU_THETA: 0.15,                              // mean-reversion speed of the OU process
  OU_SIGMA: 0.8,                               // volatility (diffusion coefficient) of the OU process
  OU_DELTA_T: 1,                               // one simulated step per tick
  TEMP_MIN_C: -55,                             // hard lower clamp for ambient temperature (°C)
  TEMP_MAX_C: -10,                             // hard upper clamp for ambient temperature (°C)
  TICK_INTERVAL_MS: 2000,                      // real-time interval between simulation ticks (ms)
  SIMULATED_HOURS_PER_TICK: 6,                 // time acceleration: each tick = 6 simulated hours (4 ticks = 1 day)
  ALERT_THRESHOLD_WARNING_DAYS: 30,            // survival-days threshold below which status becomes WARNING
  ALERT_THRESHOLD_CRITICAL_DAYS: 10,           // survival-days threshold below which status becomes CRITICAL
};

module.exports = CONSTANTS;
