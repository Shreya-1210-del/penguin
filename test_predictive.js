// test_predictive.js — Rigorous verification script for Predictive Analytics V2
import {
  SIM_CONSTANTS,
  calculateRegressionTrend,
  calculateFuelForecast,
  calculateDepletionForecast,
  calculateRiskForecast,
  calculateScenarioForecast,
} from "./predictiveUtils.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("=== RUNNING PREDICTIVE UTILS VALIDATION ===");

// 1. Time model verification (Phase 3)
assert(SIM_CONSTANTS.INTERVAL_DAYS_PER_TICK === 0.25, "1 tick = 0.25 simulated day (6h/tick)");
assert(SIM_CONSTANTS.BASE_BURN_RATE_L_PER_DAY === 62.5, "Base burn rate = 62.5 L/day");
assert(SIM_CONSTANTS.BLIZZARD_TEMP_C === -55, "Blizzard temp = -55°C");

// 2. Fuel Forecast (Phase 4)
// Formula: futureFuel = Math.max(0, currentFuel - burnRate * days)
const fuel5000 = calculateFuelForecast(5000, 62.5);
assert(fuel5000.today === 5000, "Today fuel is 5000");
assert(fuel5000.day7 === 5000 - 62.5 * 7, `Day 7: ${fuel5000.day7} === ${5000 - 62.5 * 7}`);
assert(fuel5000.day14 === 5000 - 62.5 * 14, `Day 14: ${fuel5000.day14} === ${5000 - 62.5 * 14}`);
assert(fuel5000.day30 === 5000 - 62.5 * 30, `Day 30: ${fuel5000.day30} === ${5000 - 62.5 * 30}`);

// Clamping test at zero
const lowFuel = calculateFuelForecast(100, 50);
assert(lowFuel.day7 === 0, "Day 7 clamped at 0 for low fuel");
assert(lowFuel.day14 === 0, "Day 14 clamped at 0 for low fuel");
assert(lowFuel.day30 === 0, "Day 30 clamped at 0 for low fuel");

// 3. Depletion Forecast (Phase 5)
// Physical simulation model: daysRemaining = currentFuel / Math.max(burnRate, 1)
const depl = calculateDepletionForecast(5000, 62.5);
assert(Math.abs(depl.daysRemaining - 80) < 0.001, `Depletion days remaining: ${depl.daysRemaining} === 80`);
assert(typeof depl.projectedDate === "string" && depl.projectedDate.length > 0, `Projected date generated: ${depl.projectedDate}`);

// 4. Risk Forecast (Phase 6)
// WARNING = 30 days, CRITICAL = 10 days
// Never allow negative values, clamp at zero.
const riskNominal = calculateRiskForecast(5000, 62.5); // 80 days total
assert(Math.abs(riskNominal.daysUntilWarning - 50) < 0.001, `Days until warning: ${riskNominal.daysUntilWarning} === 50`);
assert(Math.abs(riskNominal.daysUntilCritical - 70) < 0.001, `Days until critical: ${riskNominal.daysUntilCritical} === 70`);

const riskWarningZone = calculateRiskForecast(1250, 62.5); // 20 days total (already in warning, warning clamped to 0)
assert(riskWarningZone.daysUntilWarning === 0, `Days until warning clamped at 0: ${riskWarningZone.daysUntilWarning}`);
assert(Math.abs(riskWarningZone.daysUntilCritical - 10) < 0.001, `Days until critical: ${riskWarningZone.daysUntilCritical} === 10`);

const riskCriticalZone = calculateRiskForecast(312.5, 62.5); // 5 days total (both clamped to 0)
assert(riskCriticalZone.daysUntilWarning === 0, "Warning clamped at 0 when critical");
assert(riskCriticalZone.daysUntilCritical === 0, "Critical clamped at 0 when < 10 days");

// 5. Scenario Impact Forecast (Phase 7)
// BASE_BURN_RATE = 62.5, T_TARGET_C = -25, K_COEFFICIENT = 3, GENERATOR_FAILURE_MULTIPLIER = 1.5, BLIZZARD_TEMP_C = -55
// blizzardBurnRate = 62.5 + 3 * (-25 - (-55)) = 62.5 + 3 * 30 = 152.5 L/day
// blizzardDays = 5000 / 152.5 = 32.786885...
// generatorFailureBurnRate = 62.5 * 1.5 = 93.75 L/day -> generatorFailureDays = 5000 / 93.75 = 53.333...
// combinedBurnRate = 152.5 * 1.5 = 228.75 L/day -> combinedDays = 5000 / 228.75 = 21.8579...
const scenarios = calculateScenarioForecast(5000, 62.5);
assert(Math.abs(scenarios.normal - 80) < 0.001, `Normal scenario: ${scenarios.normal} days`);
const expectedBlizzardDays = 5000 / (62.5 + 3 * (-25 - (-55)));
assert(Math.abs(scenarios.blizzard - expectedBlizzardDays) < 0.001, `Blizzard scenario: ${scenarios.blizzard} days === ${expectedBlizzardDays}`);
const expectedGenFailureDays = 5000 / (62.5 * 1.5);
assert(Math.abs(scenarios.generatorFailure - expectedGenFailureDays) < 0.001, `Gen failure: ${scenarios.generatorFailure} days === ${expectedGenFailureDays}`);
const expectedCombinedDays = 5000 / ((62.5 + 3 * (-25 - (-55))) * 1.5);
assert(Math.abs(scenarios.combined - expectedCombinedDays) < 0.001, `Combined scenario: ${scenarios.combined} days === ${expectedCombinedDays}`);

// 6. Regression Trend Analysis (Phase 3 & 8)
// 1 tick = 0.25 day. If each tick loses 15.625 L (which is 62.5 L / 4 ticks):
// slope = -15.625. dailyLoss = 15.625 / 0.25 = 62.5 L/day.
// days = 5000 / 62.5 = 80 days!
const mockHistory = [];
for (let i = 0; i < 10; i++) {
  mockHistory.push({ fuel: 5000 - i * 15.625 });
}
const trend = calculateRegressionTrend(mockHistory);
assert(Math.abs(trend.slope - (-15.625)) < 0.001, `Regression slope: ${trend.slope} === -15.625`);
assert(Math.abs(trend.days - 77.75) < 0.001, `Regression days remaining with 0.25 time model: ${trend.days} === 77.75 (80 - 2.25 elapsed days)`);
assert(trend.confidence > 70, `Confidence: ${trend.confidence}% > 70%`);

console.log("\n🎯 ALL UNIT VALIDATION CHECKS PASSED PERFECTLY!\n");
