// test_weather_events.js — Automated test suite for Weather Event Engine
import {
  ANTARCTIC_THRESHOLDS,
  detectWeatherEvents,
  getInitialHistoricalEvents,
  mergeWeatherEvents,
} from "./weatherEvents.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("=== RUNNING WEATHER EVENT ENGINE VALIDATION ===");

// 1. High Wind Event Test
const highWindWeather = {
  stationId: "BHARATI",
  stationName: "Bharati Station",
  temperature: -18,
  windSpeedKmH: 54.5,
  surfacePressureHPa: 990,
  relativeHumidity: 50,
  weatherCondition: "Clear Sky",
  windDirectionCompass: "WSW",
};
const windEvents = detectWeatherEvents(highWindWeather);
const highWindEvt = windEvents.find((e) => e.type === "HIGH_WIND");
assert(highWindEvt !== undefined, "High Wind Event generated for windSpeed >= 50 km/h");
assert(highWindEvt.severity === "CRITICAL", `High Wind Event severity is CRITICAL: ${highWindEvt.severity}`);
assert(highWindEvt.station === "BHARATI", `Station is BHARATI: ${highWindEvt.station}`);
assert(typeof highWindEvt.id === "string", `Event has id: ${highWindEvt.id}`);
assert(typeof highWindEvt.timestamp === "string", `Event has timestamp: ${highWindEvt.timestamp}`);
assert(typeof highWindEvt.description === "string" && highWindEvt.description.length > 10, "Event has description");

// Katabatic wind advisory test (35 km/h)
const advisoryWindWeather = { ...highWindWeather, windSpeedKmH: 38 };
const advisoryEvents = detectWeatherEvents(advisoryWindWeather);
const advisoryEvt = advisoryEvents.find((e) => e.type === "HIGH_WIND");
assert(advisoryEvt !== undefined && advisoryEvt.severity === "WARNING", "Katabatic Wind Advisory generated at WARNING severity");

// 2. Extreme Cold Event Test
const coldWeather = {
  stationId: "MAITRI",
  stationName: "Maitri Station",
  temperature: -42.0,
  apparentTemperature: -52.0,
  windSpeedKmH: 15,
  surfacePressureHPa: 985,
  relativeHumidity: 40,
  weatherCondition: "Clear Sky",
};
const coldEvents = detectWeatherEvents(coldWeather);
const coldEvt = coldEvents.find((e) => e.type === "EXTREME_COLD");
assert(coldEvt !== undefined, "Extreme Cold Event generated for temp <= -40°C");
assert(coldEvt.severity === "CRITICAL", `Extreme Cold severity is CRITICAL: ${coldEvt.severity}`);
assert(coldEvt.station === "MAITRI", `Station is MAITRI: ${coldEvt.station}`);
assert(coldEvt.description.includes("diesel crystallization") || coldEvt.description.includes("Frostbite risk"), "Cold description has polar impact details");

// 3. Rapid Pressure Drop Test
const cycloneWeather = {
  stationId: "MAITRI",
  stationName: "Maitri Station",
  temperature: -15,
  windSpeedKmH: 20,
  surfacePressureHPa: 958.0, // Cyclone depression
  relativeHumidity: 60,
  weatherCondition: "Overcast",
};
const pressureEvents = detectWeatherEvents(cycloneWeather);
const pressureEvt = pressureEvents.find((e) => e.type === "PRESSURE_DROP");
assert(pressureEvt !== undefined, "Rapid Pressure Drop Event generated for pressure <= 960 hPa");
assert(pressureEvt.severity === "CRITICAL", `Pressure event severity is CRITICAL: ${pressureEvt.severity}`);
assert(pressureEvt.description.includes("polar cyclone"), "Pressure description details polar cyclone depression");

// Pressure Delta Test (rapid plunge)
const prevReading = { surfacePressureHPa: 980.0 };
const currentReading = { ...cycloneWeather, surfacePressureHPa: 972.0 }; // Dropped 8 hPa!
const deltaEvents = detectWeatherEvents(currentReading, prevReading);
const dropEvt = deltaEvents.find((e) => e.type === "PRESSURE_DROP");
assert(dropEvt !== undefined && dropEvt.metric.includes("-8.0 hPa"), "Rapid pressure drop delta detected");

// 4. Severe Weather Alert Test (Blizzard condition)
const blizzardWeather = {
  stationId: "BHARATI",
  stationName: "Bharati Station",
  temperature: -35.0,
  windSpeedKmH: 55.0,
  surfacePressureHPa: 965.0,
  relativeHumidity: 90,
  weatherCondition: "Heavy Snow Showers",
  weatherCode: 86, // WMO Heavy Snow Showers
};
const blizzardEvents = detectWeatherEvents(blizzardWeather);
const severeEvt = blizzardEvents.find((e) => e.type === "SEVERE_WEATHER");
assert(severeEvt !== undefined, "Severe Weather Alert generated for combined blizzard criteria");
assert(severeEvt.severity === "CRITICAL", `Severe Weather Alert severity is CRITICAL: ${severeEvt.severity}`);

// 5. Event Sorting & Newest First Ordering
const tNow = Date.now();
const oldEvent = { id: "old", timestamp: new Date(tNow - 100000).toISOString(), severity: "INFO" };
const midEvent = { id: "mid", timestamp: new Date(tNow - 50000).toISOString(), severity: "WARNING" };
const newEvent = { id: "new", timestamp: new Date(tNow).toISOString(), severity: "CRITICAL" };

const merged = mergeWeatherEvents([oldEvent, midEvent], [newEvent]);
assert(merged[0].id === "new", "Newest event is first at index 0");
assert(merged[1].id === "mid", "Second newest event is at index 1");
assert(merged[2].id === "old", "Oldest event is at index 2");
assert(merged.length === 3, "Merged event count is 3");

// Deduplication test
const deduped = mergeWeatherEvents(merged, [newEvent]);
assert(deduped.length === 3, "Duplicate event ID correctly ignored in mergeWeatherEvents");

console.log("\n🎯 ALL WEATHER EVENT ENGINE & TIMELINE TESTS PASSED FLAWLESSLY!\n");
