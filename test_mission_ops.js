// test_mission_ops.js — Automated test for Mission Operations Center & Feature Modal logic

import assert from "node:assert";
import { STATIONS } from "./data/stations.js";
import { evaluateWeatherImpacts } from "./services/weatherImpactEngine.js";
import { evaluateOperationalRisk, evaluatePersonnelRisk, evaluateEquipmentRisk, assessStationRisk } from "./services/riskEngine.js";
import { detectWeatherEvents, getInitialHistoricalEvents, mergeWeatherEvents } from "./weatherEvents.js";
import { getPolarScoreFromWeather, calculatePolarScore } from "./polarScoreUtils.js";

console.log("=== RUNNING MISSION OPERATIONS CENTER COMPONENT INTEGRATION TEST ===");

// 1. Station Registry
assert.ok(STATIONS.BHARATI, "Bharati station exists");
assert.ok(STATIONS.MAITRI, "Maitri station exists");
console.log("✅ Stations verified in registry");

// 2. Mock live weather
const mockWeather = {
  stationId: "BHARATI",
  stationName: "Bharati Station",
  temperature: -24.5,
  apparentTemperature: -34.2,
  windSpeedKmH: 42.0,
  windDirectionDeg: 195,
  windDirectionCompass: "SSW",
  surfacePressureHPa: 972.0,
  relativeHumidity: 78,
  weatherCondition: "Blowing Snow",
  weatherCode: 77,
  coordinates: { latitude: -69.4072, longitude: 76.1872 },
  elevationM: 35,
  isFallback: false,
  fetchedAt: new Date().toISOString(),
};

// 3. Weather Impact Engine Evaluation
const impacts = evaluateWeatherImpacts(mockWeather);
assert.ok(impacts.overallStatus, "Overall status must exist");
assert.ok(["NORMAL", "WATCH", "WARNING", "CRITICAL"].includes(impacts.overallStatus), `Invalid status: ${impacts.overallStatus}`);
console.log(`✅ Weather Impact Engine overall status: ${impacts.overallStatus}`);

// 4. Polar Condition Score
const polarScore = getPolarScoreFromWeather(mockWeather);
assert.ok(polarScore.score >= 0 && polarScore.score <= 100, `Score out of bounds: ${polarScore.score}`);
assert.ok(polarScore.status, "Status exists");
assert.ok(polarScore.components, "Component breakdown exists");
console.log(`✅ Polar Condition Score: ${polarScore.score} (${polarScore.status})`);

// 5. Risk Engine
const risks = assessStationRisk(mockWeather);
assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risks.operational.level), "Operational risk level invalid");
assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risks.personnel.level), "Personnel risk level invalid");
assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risks.equipment.level), "Equipment risk level invalid");
console.log(`✅ Risk Vectors — Operational: ${risks.operational.level}, Personnel: ${risks.personnel.level}, Equipment: ${risks.equipment.level}`);

// 6. Weather Events detection
const detectedEvents = detectWeatherEvents(mockWeather);
assert.ok(Array.isArray(detectedEvents), "Detected events must be array");
console.log(`✅ Detected weather events count: ${detectedEvents.length}`);

// 7. Event chronological sort (newest first)
const historical = getInitialHistoricalEvents();
const merged = mergeWeatherEvents(historical, detectedEvents, 20);
for (let i = 0; i < merged.length - 1; i++) {
  const tA = new Date(merged[i].timestamp).getTime();
  const tB = new Date(merged[i + 1].timestamp).getTime();
  assert.ok(tA >= tB, `Event ${i} (${tA}) is not newer than Event ${i + 1} (${tB})`);
}
console.log("✅ Event feed is strictly chronologically ordered (newest first)");

console.log("\n🎯 ALL MISSION OPERATIONS CENTER LOGIC CHECKS PASSED FLAWLESSLY!");
