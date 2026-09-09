// services/weatherService.js — Open-Meteo Real-Time Weather Integration
// Indian Antarctic Research Stations (Bharati & Maitri)

import { getStation, STATIONS } from "../data/stations.js";

export const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";
export const DEFAULT_TIMEOUT_MS = 10000;

// WMO Weather Interpretation Codes (WW)
export const WMO_WEATHER_CODES = {
  0: "Clear Sky",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing Rime Fog",
  51: "Light Drizzle",
  53: "Moderate Drizzle",
  55: "Dense Drizzle",
  61: "Slight Rain",
  63: "Moderate Rain",
  65: "Heavy Rain",
  71: "Slight Snow Fall",
  73: "Moderate Snow Fall",
  75: "Heavy Snow Fall",
  77: "Snow Grains",
  80: "Slight Rain Showers",
  81: "Moderate Rain Showers",
  82: "Violent Rain Showers",
  85: "Slight Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm with Slight Hail",
  99: "Thunderstorm with Heavy Hail",
};

/**
 * Returns human-readable weather condition for WMO code.
 */
export function getWeatherDescription(code) {
  if (code == null) return "Unknown";
  return WMO_WEATHER_CODES[code] || `Weather Condition (${code})`;
}

/**
 * Converts wind bearing in degrees (0-360) to 16-point compass quadrant.
 */
export function getWindDirectionCompass(degrees) {
  if (degrees == null || isNaN(degrees)) return "N/A";
  const sectors = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return sectors[index];
}

/**
 * Normalizes Open-Meteo raw forecast JSON response into a consistent schema.
 */
export function normalizeWeatherResponse(data, stationInfo = {}) {
  if (!data || !data.current) {
    throw new Error("Invalid Open-Meteo API response: missing 'current' payload");
  }

  const current = data.current;
  const temp = Number(current.temperature_2m);
  const apparentTemp = Number(current.apparent_temperature ?? temp);
  const windSpeedKmH = Number(current.wind_speed_10m ?? 0);
  const windDirectionDeg = Number(current.wind_direction_10m ?? 0);
  const surfacePressure = Number(current.surface_pressure ?? 1013.25);
  const humidity = Number(current.relative_humidity_2m ?? 0);
  const weatherCode = current.weather_code != null ? Number(current.weather_code) : null;

  return {
    stationId: stationInfo.id || "UNKNOWN",
    stationName: stationInfo.name || "Antarctic Station",
    fullName: stationInfo.fullName || stationInfo.name || "Antarctic Research Station",
    location: stationInfo.location || "Antarctica",
    coordinates: {
      latitude: Number(stationInfo.latitude ?? data.latitude),
      longitude: Number(stationInfo.longitude ?? data.longitude),
      elevation: Number(stationInfo.elevationMeters ?? data.elevation ?? 0),
    },
    gridCoordinates: {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      elevation: Number(data.elevation ?? 0),
    },
    timestamp: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    timezone: data.timezone || stationInfo.timezone || "UTC",
    timezoneAbbreviation: data.timezone_abbreviation || "",
    // Meteorological metrics
    temperature: temp,
    apparentTemperature: apparentTemp,
    relativeHumidity: humidity,
    surfacePressureHPa: surfacePressure,
    windSpeedKmH: windSpeedKmH,
    windSpeedMs: Number((windSpeedKmH / 3.6).toFixed(2)),
    windDirectionDeg: windDirectionDeg,
    windDirectionCompass: getWindDirectionCompass(windDirectionDeg),
    weatherCode: weatherCode,
    weatherCondition: getWeatherDescription(weatherCode),
    // Polar domain status flags
    isExtremeCold: temp <= -35,
    isBlizzardRisk: windSpeedKmH >= 45 && temp <= -20,
    units: data.current_units || {
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      apparent_temperature: "°C",
      surface_pressure: "hPa",
      wind_speed_10m: "km/h",
      wind_direction_10m: "°",
    },
    raw: data,
  };
}

/**
 * Generates an informative offline/fallback weather object when the network is unreachable.
 */
export function getFallbackWeather(stationIdOrObject, errorReason = "Offline / Connection Error") {
  const station = typeof stationIdOrObject === "object" ? stationIdOrObject : getStation(stationIdOrObject);
  return {
    stationId: station.id,
    stationName: station.name,
    fullName: station.fullName,
    location: station.location,
    coordinates: {
      latitude: station.latitude,
      longitude: station.longitude,
      elevation: station.elevationMeters,
    },
    timestamp: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    timezone: station.timezone,
    timezoneAbbreviation: "UTC",
    temperature: station.id === "BHARATI" ? -18.5 : -21.0,
    apparentTemperature: station.id === "BHARATI" ? -24.0 : -28.5,
    relativeHumidity: 65,
    surfacePressureHPa: 980.0,
    windSpeedKmH: 22.0,
    windSpeedMs: 6.11,
    windDirectionDeg: 180,
    windDirectionCompass: "S",
    weatherCode: 1,
    weatherCondition: "Mainly Clear (Estimated)",
    isExtremeCold: false,
    isBlizzardRisk: false,
    isFallback: true,
    fallbackReason: errorReason,
    units: {
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      apparent_temperature: "°C",
      surface_pressure: "hPa",
      wind_speed_10m: "km/h",
      wind_direction_10m: "°",
    },
    raw: null,
  };
}

/**
 * Fetches real-time weather from Open-Meteo for arbitrary coordinates.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {object} options Options including timeoutMs, signal, timezone
 * @returns {Promise<object>} Raw Open-Meteo JSON
 */
export async function fetchWeatherByCoordinates(latitude, longitude, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: userSignal, timezone = "auto" } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link caller signal if provided
  if (userSignal) {
    userSignal.addEventListener("abort", () => controller.abort());
  }

  const queryParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code",
    timezone: timezone,
  });

  const url = `${OPEN_METEO_BASE_URL}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Open-Meteo API error (${response.status}): ${errorText || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Open-Meteo request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches and normalizes weather for a specific Antarctic station (Bharati or Maitri).
 *
 * @param {string|object} stationIdOrObject Station key (e.g. "BHARATI", "MAITRI") or station object
 * @param {object} options
 * @returns {Promise<object>} Normalized weather schema
 */
export async function fetchStationWeather(stationIdOrObject, options = {}) {
  const station = typeof stationIdOrObject === "object" ? stationIdOrObject : getStation(stationIdOrObject);
  if (!station || station.latitude == null || station.longitude == null) {
    throw new Error(`Invalid station or missing coordinates for: ${JSON.stringify(stationIdOrObject)}`);
  }

  const rawData = await fetchWeatherByCoordinates(station.latitude, station.longitude, {
    ...options,
    timezone: station.timezone || "auto",
  });

  return normalizeWeatherResponse(rawData, station);
}

/**
 * Fetches real-time weather for all registered Antarctic stations concurrently.
 *
 * @param {object} options
 * @returns {Promise<Record<string, object>>} Keyed by station ID
 */
export async function fetchAllStationsWeather(options = {}) {
  const stationKeys = Object.keys(STATIONS);
  const results = await Promise.allSettled(
    stationKeys.map((key) => fetchStationWeather(key, options))
  );

  const weatherMap = {};
  stationKeys.forEach((key, index) => {
    const res = results[index];
    if (res.status === "fulfilled") {
      weatherMap[key] = res.value;
    } else {
      console.warn(`[weatherService] Failed fetching weather for ${key}:`, res.reason);
      weatherMap[key] = getFallbackWeather(key, res.reason?.message || "Fetch failed");
    }
  });

  return weatherMap;
}

export { calculatePolarScore, getPolarScoreFromWeather } from "../polarScoreUtils.js";

export default {
  OPEN_METEO_BASE_URL,
  WMO_WEATHER_CODES,
  getWeatherDescription,
  getWindDirectionCompass,
  normalizeWeatherResponse,
  getFallbackWeather,
  fetchWeatherByCoordinates,
  fetchStationWeather,
  fetchAllStationsWeather,
};

