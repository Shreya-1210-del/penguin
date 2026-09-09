// frontend/test_weather_impact.js — Validation for Weather Impact Engine
import assert from "node:assert";
import {
  evaluateWeatherImpacts,
  evaluatePowerDemand,
  evaluateCommunicationReliability,
  evaluateEquipmentStress,
  evaluateOutdoorOperationAvailability,
  IMPACT_STATUS,
} from "./services/weatherImpactEngine.js";

console.log("=== RUNNING WEATHER IMPACT ENGINE VALIDATION ===");

// 1. Baseline / Nominal Polar Weather
const mildWeather = {
  temperature: -6,
  apparentTemperature: -8,
  windSpeedKmH: 10,
  relativeHumidity: 45,
  surfacePressureHPa: 998,
  stationId: "BHARATI",
  stationName: "Bharati Station",
};

const mildImpacts = evaluateWeatherImpacts(mildWeather);

assert.strictEqual(mildImpacts.powerDemand.status, IMPACT_STATUS.NORMAL);
console.log(`✅ Power Demand is NORMAL: ${mildImpacts.powerDemand.value}`);

assert.strictEqual(mildImpacts.communicationReliability.status, IMPACT_STATUS.NORMAL);
console.log(`✅ Communication Reliability is NORMAL: ${mildImpacts.communicationReliability.value}`);

assert.strictEqual(mildImpacts.equipmentStress.status, IMPACT_STATUS.NORMAL);
console.log(`✅ Equipment Stress is NORMAL: ${mildImpacts.equipmentStress.value}`);

assert.strictEqual(mildImpacts.outdoorOperationAvailability.status, IMPACT_STATUS.NORMAL);
console.log(`✅ Outdoor Operation Availability is NORMAL: ${mildImpacts.outdoorOperationAvailability.value}`);

assert.strictEqual(mildImpacts.overallStatus, IMPACT_STATUS.NORMAL);
console.log(`✅ Overall Status is NORMAL: ${mildImpacts.overallStatus}`);

// 2. Watch Conditions
const watchWeather = {
  temperature: -23,
  apparentTemperature: -28,
  windSpeedKmH: 32,
  relativeHumidity: 60,
  surfacePressureHPa: 979,
  stationId: "MAITRI",
};

const watchImpacts = evaluateWeatherImpacts(watchWeather);
assert.strictEqual(watchImpacts.powerDemand.status, IMPACT_STATUS.WATCH);
assert.strictEqual(watchImpacts.communicationReliability.status, IMPACT_STATUS.WATCH);
assert.strictEqual(watchImpacts.equipmentStress.status, IMPACT_STATUS.WATCH);
assert.strictEqual(watchImpacts.outdoorOperationAvailability.status, IMPACT_STATUS.WATCH);
assert.strictEqual(watchImpacts.overallStatus, IMPACT_STATUS.WATCH);
console.log(`✅ All impacts correctly evaluated as WATCH`);

// 3. Warning Conditions (Individual Vector Tests)
const warningPower = evaluatePowerDemand({ temp: -32, wind: 34, humidity: 60, pressure: 975 });
assert.strictEqual(warningPower.status, IMPACT_STATUS.WARNING);
console.log(`✅ Power Demand WARNING: ${warningPower.value} (${warningPower.subtext})`);

const warningComms = evaluateCommunicationReliability({ temp: -25, wind: 48, humidity: 75, pressure: 968 });
assert.strictEqual(warningComms.status, IMPACT_STATUS.WARNING);
console.log(`✅ Communication Reliability WARNING: ${warningComms.value} (${warningComms.mode})`);

const warningEquip = evaluateEquipmentStress({ temp: -36, wind: 48, humidity: 60, pressure: 975 });
assert.strictEqual(warningEquip.status, IMPACT_STATUS.WARNING);
console.log(`✅ Equipment Stress WARNING: ${warningEquip.value}`);

const warningOutdoor = evaluateOutdoorOperationAvailability({ temp: -30, wind: 42, humidity: 60, pressure: 972, apparentTemp: -36 });
assert.strictEqual(warningOutdoor.status, IMPACT_STATUS.WARNING);
console.log(`✅ Outdoor Availability WARNING: ${warningOutdoor.value} (${warningOutdoor.windowDuration})`);

// Warning Composite Evaluation
const warningCompositeWeather = {
  temperature: -28,
  apparentTemperature: -33,
  windSpeedKmH: 34,
  relativeHumidity: 72,
  surfacePressureHPa: 971,
  stationId: "BHARATI",
};
const warningComposite = evaluateWeatherImpacts(warningCompositeWeather);
assert.strictEqual(warningComposite.overallStatus, IMPACT_STATUS.WARNING);
console.log(`✅ Warning Composite Overall Status: ${warningComposite.overallStatus}`);

// 4. Critical Conditions
const criticalWeather = {
  temperature: -48,
  apparentTemperature: -58,
  windSpeedKmH: 74,
  relativeHumidity: 88,
  surfacePressureHPa: 952,
  stationId: "MAITRI",
};

const criticalImpacts = evaluateWeatherImpacts(criticalWeather);
assert.strictEqual(criticalImpacts.powerDemand.status, IMPACT_STATUS.CRITICAL);
assert.strictEqual(criticalImpacts.communicationReliability.status, IMPACT_STATUS.CRITICAL);
assert.strictEqual(criticalImpacts.equipmentStress.status, IMPACT_STATUS.CRITICAL);
assert.strictEqual(criticalImpacts.outdoorOperationAvailability.status, IMPACT_STATUS.CRITICAL);
assert.strictEqual(criticalImpacts.overallStatus, IMPACT_STATUS.CRITICAL);
console.log(`✅ All impacts correctly evaluated as CRITICAL`);

// 5. Verification of Statuses Set
const allowedStatuses = new Set(["NORMAL", "WATCH", "WARNING", "CRITICAL"]);
assert.ok(allowedStatuses.has(mildImpacts.powerDemand.status));
assert.ok(allowedStatuses.has(mildImpacts.communicationReliability.status));
assert.ok(allowedStatuses.has(mildImpacts.equipmentStress.status));
assert.ok(allowedStatuses.has(mildImpacts.outdoorOperationAvailability.status));
assert.ok(allowedStatuses.has(warningComposite.overallStatus));
assert.ok(allowedStatuses.has(criticalImpacts.overallStatus));
console.log(`✅ Statuses strictly adhere to: NORMAL, WATCH, WARNING, CRITICAL`);

// 6. Integration Verification
assert.ok(mildImpacts.riskAssessment, "Risk assessment present");
assert.ok(mildImpacts.riskAssessment.overallRiskLevel, "Risk overallRiskLevel present");
assert.ok(Array.isArray(mildImpacts.activeEvents), "Active events is an array");
assert.strictEqual(mildImpacts.stationId, "BHARATI");
assert.strictEqual(mildImpacts.inputs.temperature, -6);
assert.strictEqual(mildImpacts.inputs.windSpeedKmH, 10);
assert.strictEqual(mildImpacts.inputs.relativeHumidity, 45);
assert.strictEqual(mildImpacts.inputs.surfacePressureHPa, 998);
console.log(`✅ Risk Engine and Weather Event Engine successfully integrated`);

console.log("\n🎯 ALL WEATHER IMPACT ENGINE TESTS PASSED FLAWLESSLY!\n");
