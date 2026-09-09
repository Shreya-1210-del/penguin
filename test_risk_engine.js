// test_risk_engine.js — Automated verification of Polar Risk Engine
import {
  evaluatePersonnelRisk,
  evaluateEquipmentRisk,
  evaluateOperationalRisk,
  assessStationRisk,
  RISK_LEVELS,
} from "./services/riskEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("=== RUNNING POLAR RISK ENGINE VALIDATION ===");

// 1. Nominal / Low Risk Weather Condition
const nominalWeather = {
  stationId: "BHARATI",
  stationName: "Bharati Station",
  temperature: -14.0,
  apparentTemperature: -18.0,
  windSpeedKmH: 8.0,
  surfacePressureHPa: 995.0,
  relativeHumidity: 45,
};

const nominalRisk = assessStationRisk(nominalWeather);
assert(nominalRisk.personnel.level === RISK_LEVELS.LOW, `Personnel risk is LOW: ${nominalRisk.personnel.level}`);
assert(nominalRisk.equipment.level === RISK_LEVELS.LOW, `Equipment risk is LOW: ${nominalRisk.equipment.level}`);
assert(nominalRisk.operational.level === RISK_LEVELS.LOW, `Operational risk is LOW: ${nominalRisk.operational.level}`);
assert(nominalRisk.overallRiskLevel === RISK_LEVELS.LOW, `Overall risk is LOW: ${nominalRisk.overallRiskLevel}`);

// 2. Moderate / Medium Risk Condition
const moderateWeather = {
  stationId: "MAITRI",
  stationName: "Maitri Station",
  temperature: -28.0,
  apparentTemperature: -34.0,
  windSpeedKmH: 28.0,
  surfacePressureHPa: 978.0,
  relativeHumidity: 70,
};

const moderateRisk = assessStationRisk(moderateWeather);
assert(moderateRisk.personnel.level === RISK_LEVELS.MEDIUM, `Personnel risk is MEDIUM: ${moderateRisk.personnel.level}`);
assert(moderateRisk.equipment.level === RISK_LEVELS.MEDIUM, `Equipment risk is MEDIUM: ${moderateRisk.equipment.level}`);
assert(moderateRisk.operational.level === RISK_LEVELS.MEDIUM, `Operational risk is MEDIUM: ${moderateRisk.operational.level}`);
assert(moderateRisk.overallRiskLevel === RISK_LEVELS.MEDIUM, `Overall risk is MEDIUM: ${moderateRisk.overallRiskLevel}`);

// 3. High Risk Condition
const highRiskWeather = {
  stationId: "MAITRI",
  stationName: "Maitri Station",
  temperature: -38.0,
  apparentTemperature: -44.0,
  windSpeedKmH: 48.0,
  surfacePressureHPa: 964.0,
  relativeHumidity: 82,
};

const highRisk = assessStationRisk(highRiskWeather);
assert(highRisk.personnel.level === RISK_LEVELS.HIGH, `Personnel risk is HIGH: ${highRisk.personnel.level}`);
assert(highRisk.equipment.level === RISK_LEVELS.HIGH, `Equipment risk is HIGH: ${highRisk.equipment.level}`);
assert(highRisk.operational.level === RISK_LEVELS.HIGH, `Operational risk is HIGH: ${highRisk.operational.level}`);
assert(highRisk.overallRiskLevel === RISK_LEVELS.HIGH, `Overall risk is HIGH: ${highRisk.overallRiskLevel}`);

// 4. Critical Risk / Emergency Blizzard Condition
const criticalWeather = {
  stationId: "BHARATI",
  stationName: "Bharati Station",
  temperature: -52.0,
  apparentTemperature: -65.0,
  windSpeedKmH: 76.0,
  surfacePressureHPa: 948.0,
  relativeHumidity: 94,
  weatherCode: 86, // Heavy snow showers
};

const criticalRisk = assessStationRisk(criticalWeather);
assert(criticalRisk.personnel.level === RISK_LEVELS.CRITICAL, `Personnel risk is CRITICAL: ${criticalRisk.personnel.level}`);
assert(criticalRisk.equipment.level === RISK_LEVELS.CRITICAL, `Equipment risk is CRITICAL: ${criticalRisk.equipment.level}`);
assert(criticalRisk.operational.level === RISK_LEVELS.CRITICAL, `Operational risk is CRITICAL: ${criticalRisk.operational.level}`);
assert(criticalRisk.overallRiskLevel === RISK_LEVELS.CRITICAL, `Overall risk is CRITICAL: ${criticalRisk.overallRiskLevel}`);

// 5. Verify Output Fields & Structure
assert(Array.isArray(nominalRisk.personnel.factors), "Factors array present on personnel risk");
assert(typeof nominalRisk.equipment.advisory === "string", "Advisory text present on equipment risk");
assert(typeof nominalRisk.averageScore === "number", `Average score is number: ${nominalRisk.averageScore}`);

console.log("\n🎯 ALL POLAR RISK ENGINE TESTS PASSED FLAWLESSLY!\n");
