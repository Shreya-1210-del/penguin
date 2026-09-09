// test_weather.js — Comprehensive verification of Antarctic Weather Architecture
import { STATIONS, getStation, STATION_LIST, DEFAULT_STATION_ID } from "./data/stations.js";
import {
  OPEN_METEO_BASE_URL,
  getWeatherDescription,
  getWindDirectionCompass,
  normalizeWeatherResponse,
  getFallbackWeather,
  fetchWeatherByCoordinates,
  fetchStationWeather,
  fetchAllStationsWeather,
} from "./services/weatherService.js";
import { DEFAULT_WEATHER_REFRESH_MS } from "./hooks/useWeather.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("=== RUNNING ANTARCTIC WEATHER ARCHITECTURE VALIDATION ===");

// 1. Station Registry & Coordinate Accuracy
assert(STATIONS.BHARATI !== undefined, "Bharati station registered in STATIONS");
assert(STATIONS.MAITRI !== undefined, "Maitri station registered in STATIONS");
assert(typeof STATIONS.BHARATI.latitude === "number" && STATIONS.BHARATI.latitude < -69, "Bharati latitude is ~ -69.4° S");
assert(typeof STATIONS.BHARATI.longitude === "number" && STATIONS.BHARATI.longitude > 75, "Bharati longitude is ~ 76.1° E");
assert(typeof STATIONS.MAITRI.latitude === "number" && STATIONS.MAITRI.latitude < -70, "Maitri latitude is ~ -70.7° S");
assert(typeof STATIONS.MAITRI.longitude === "number" && STATIONS.MAITRI.longitude > 11, "Maitri longitude is ~ 11.7° E");

// Helper function tests
assert(getStation("BHARATI").id === "BHARATI", "getStation('BHARATI') returns Bharati");
assert(getStation("bharati").id === "BHARATI", "getStation case-insensitivity works");
assert(getStation("MAITRI").id === "MAITRI", "getStation('MAITRI') returns Maitri");
assert(getStation("maitri").id === "MAITRI", "getStation('maitri') returns Maitri");
assert(getStation("NON_EXISTENT").id === DEFAULT_STATION_ID, "getStation falls back to default station");

// 2. Weather Hook Configuration
assert(DEFAULT_WEATHER_REFRESH_MS === 300000, "Automatic refresh interval is exactly 5 minutes (300,000 ms)");

// 3. Meteorological Utility Functions
assert(getWeatherDescription(0) === "Clear Sky", "WMO 0 translates to 'Clear Sky'");
assert(getWeatherDescription(71) === "Slight Snow Fall", "WMO 71 translates to 'Slight Snow Fall'");
assert(getWeatherDescription(95) === "Thunderstorm", "WMO 95 translates to 'Thunderstorm'");

assert(getWindDirectionCompass(0) === "N", "Wind 0° is North");
assert(getWindDirectionCompass(90) === "E", "Wind 90° is East");
assert(getWindDirectionCompass(180) === "S", "Wind 180° is South");
assert(getWindDirectionCompass(270) === "W", "Wind 270° is West");
assert(getWindDirectionCompass(239) === "WSW", "Wind 239° is WSW");

// 4. Offline Fallback Weather Generation
const fallbackBharati = getFallbackWeather("BHARATI", "Test network disconnect");
assert(fallbackBharati.isFallback === true, "Fallback weather object is marked isFallback=true");
assert(fallbackBharati.stationId === "BHARATI", "Fallback maps to correct station ID");
assert(typeof fallbackBharati.temperature === "number", "Fallback provides numeric temperature");

// 5. Live Open-Meteo API Fetching
console.log("\nTesting live Open-Meteo API fetch...");
try {
  const bharatiWeather = await fetchStationWeather("BHARATI", { timeoutMs: 12000 });
  assert(bharatiWeather.stationId === "BHARATI", "Fetched live weather for Bharati Station");
  assert(typeof bharatiWeather.temperature === "number", `Bharati live temp: ${bharatiWeather.temperature}°C`);
  assert(typeof bharatiWeather.apparentTemperature === "number", `Bharati feels like: ${bharatiWeather.apparentTemperature}°C`);
  assert(typeof bharatiWeather.windSpeedKmH === "number", `Bharati wind speed: ${bharatiWeather.windSpeedKmH} km/h`);
  assert(typeof bharatiWeather.windDirectionCompass === "string", `Bharati wind compass: ${bharatiWeather.windDirectionCompass}`);
  assert(typeof bharatiWeather.surfacePressureHPa === "number", `Bharati pressure: ${bharatiWeather.surfacePressureHPa} hPa`);
  assert(typeof bharatiWeather.weatherCondition === "string", `Bharati condition: ${bharatiWeather.weatherCondition}`);
  assert(bharatiWeather.coordinates.latitude === STATIONS.BHARATI.latitude, "Bharati latitude preserved in normalized result");

  const maitriWeather = await fetchStationWeather("MAITRI", { timeoutMs: 12000 });
  assert(maitriWeather.stationId === "MAITRI", "Fetched live weather for Maitri Station");
  assert(typeof maitriWeather.temperature === "number", `Maitri live temp: ${maitriWeather.temperature}°C`);
  assert(typeof maitriWeather.windSpeedKmH === "number", `Maitri wind speed: ${maitriWeather.windSpeedKmH} km/h`);

  const allWeather = await fetchAllStationsWeather({ timeoutMs: 12000 });
  assert(allWeather.BHARATI !== undefined && allWeather.MAITRI !== undefined, "fetchAllStationsWeather fetched both stations successfully");

  // 6. Polar Condition Score Validation
  console.log("\nTesting Polar Condition Score Algorithm...");
  const { calculatePolarScore, getPolarScoreFromWeather } = await import("./polarScoreUtils.js");

  // Test Optimal (80-100)
  const optimal = calculatePolarScore({ temperature: -12, windSpeed: 8, humidity: 45, pressure: 998 });
  assert(optimal.score >= 80 && optimal.score <= 100, `Optimal score in 80-100: ${optimal.score}`);
  assert(optimal.status === "Optimal", `Status is 'Optimal': ${optimal.status}`);

  // Test Stable (60-79)
  const stable = calculatePolarScore({ temperature: -26, windSpeed: 32, humidity: 60, pressure: 980 });
  assert(stable.score >= 60 && stable.score <= 79, `Stable score in 60-79: ${stable.score}`);
  assert(stable.status === "Stable", `Status is 'Stable': ${stable.status}`);

  // Test Warning (40-59)
  const warning = calculatePolarScore({ temperature: -36, windSpeed: 42, humidity: 72, pressure: 968 });
  assert(warning.score >= 40 && warning.score <= 59, `Warning score in 40-59: ${warning.score}`);
  assert(warning.status === "Warning", `Status is 'Warning': ${warning.status}`);

  // Test High Risk (20-39)
  const highRisk = calculatePolarScore({ temperature: -46, windSpeed: 58, humidity: 85, pressure: 955 });
  assert(highRisk.score >= 20 && highRisk.score <= 39, `High Risk score in 20-39: ${highRisk.score}`);
  assert(highRisk.status === "High Risk", `Status is 'High Risk': ${highRisk.status}`);

  // Test Critical (0-19)
  const critical = calculatePolarScore({ temperature: -55, windSpeed: 78, humidity: 95, pressure: 945 });
  assert(critical.score >= 0 && critical.score <= 19, `Critical score in 0-19: ${critical.score}`);
  assert(critical.status === "Critical", `Status is 'Critical': ${critical.status}`);

  // Test live station polar scores
  const bharatiScore = getPolarScoreFromWeather(bharatiWeather);
  assert(bharatiScore.score >= 0 && bharatiScore.score <= 100, `Bharati polar score: ${bharatiScore.score} (${bharatiScore.status})`);

  const maitriScore = getPolarScoreFromWeather(maitriWeather);
  assert(maitriScore.score >= 0 && maitriScore.score <= 100, `Maitri polar score: ${maitriScore.score} (${maitriScore.status})`);

  console.log("\n🎯 ALL ANTARCTIC WEATHER & POLAR SCORE TESTS PASSED FLAWLESSLY!\n");
} catch (err) {
  console.error("Live fetch test error:", err);
  process.exit(1);
}

