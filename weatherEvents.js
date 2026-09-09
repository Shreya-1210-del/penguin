// weatherEvents.js — Weather Event Engine for Antarctic Stations
// Detects and generates real-time meteorological anomaly events using realistic Antarctic physics

export const ANTARCTIC_THRESHOLDS = {
  // High Wind thresholds (km/h)
  WIND_WARNING_KMH: 35,     // Katabatic wind advisory / drift snow
  WIND_CRITICAL_KMH: 50,    // Severe katabatic gale / outdoor movement restricted
  WIND_SEVERE_KMH: 75,      // Hurricane-force blizzard gusts

  // Extreme Cold thresholds (°C)
  COLD_WARNING_C: -30,      // Severe cold / fuel pre-heating advisory
  COLD_CRITICAL_C: -40,     // Extreme frostbite hazard (< 5 min exposed skin)
  COLD_SEVERE_C: -50,       // Emergency polar freeze / generator overload risk

  // Apparent Temperature / Wind Chill (°C)
  WIND_CHILL_CRITICAL_C: -38,

  // Atmospheric Pressure thresholds (hPa)
  PRESSURE_DEPRESSION_HPA: 975, // Approaching low-pressure trough
  PRESSURE_CYCLONE_HPA: 960,    // Deep cyclonic depression / active storm front
  PRESSURE_DROP_DELTA_HPA: 2.5, // Rapid barometric plunge trigger
};

/**
 * Evaluates current and previous weather readings to automatically generate
 * real-time Antarctic Weather Events.
 *
 * Supported Event Types:
 * 1. High Wind Event
 * 2. Extreme Cold Event
 * 3. Rapid Pressure Drop
 * 4. Severe Weather Alert
 *
 * @param {object} weather - Current normalized weather object
 * @param {object} [previousWeather] - Prior weather reading (for delta detection)
 * @returns {Array<object>} Array of detected weather event objects
 */
export function detectWeatherEvents(weather, previousWeather = null) {
  if (!weather) return [];

  const events = [];
  const stationId = weather.stationId || "BHARATI";
  const stationName = weather.stationName || "Antarctic Station";
  const now = new Date();
  const timestamp = weather.fetchedAt || now.toISOString();

  const temp = Number(weather.temperature ?? -20);
  const apparentTemp = Number(weather.apparentTemperature ?? temp);
  const windSpeed = Number(weather.windSpeedKmH ?? 0);
  const pressure = Number(weather.surfacePressureHPa ?? 990);
  const humidity = Number(weather.relativeHumidity ?? 50);
  const condition = weather.weatherCondition || "Clear";
  const code = weather.weatherCode;

  // 1. High Wind Event Detection
  if (windSpeed >= ANTARCTIC_THRESHOLDS.WIND_SEVERE_KMH) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-wind-severe`,
      type: "HIGH_WIND",
      title: "Severe Blizzard Gale Event",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${windSpeed.toFixed(1)} km/h`,
      description: `Extreme katabatic gale clocking ${windSpeed.toFixed(1)} km/h (${weather.windDirectionCompass || "S"}). Zero-visibility drift snow hazard.`,
    });
  } else if (windSpeed >= ANTARCTIC_THRESHOLDS.WIND_CRITICAL_KMH) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-wind-critical`,
      type: "HIGH_WIND",
      title: "High Wind Event",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${windSpeed.toFixed(1)} km/h`,
      description: `High wind velocity sustained at ${windSpeed.toFixed(1)} km/h (${weather.windDirectionCompass || "S"}). Station exterior movement suspended.`,
    });
  } else if (windSpeed >= ANTARCTIC_THRESHOLDS.WIND_WARNING_KMH) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-wind-warning`,
      type: "HIGH_WIND",
      title: "Katabatic Wind Advisory",
      severity: "WARNING",
      station: stationId,
      stationName,
      timestamp,
      metric: `${windSpeed.toFixed(1)} km/h`,
      description: `Elevated katabatic wind flow observed at ${windSpeed.toFixed(1)} km/h (${weather.windDirectionCompass || "S"}). Surface snow drift active.`,
    });
  }

  // 2. Extreme Cold Event Detection
  if (temp <= ANTARCTIC_THRESHOLDS.COLD_SEVERE_C) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-cold-severe`,
      type: "EXTREME_COLD",
      title: "Extreme Cold Event",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${temp.toFixed(1)}°C`,
      description: `Deep polar freeze at ${temp.toFixed(1)}°C (Feels like ${apparentTemp.toFixed(1)}°C). Immediate diesel crystallization & generator overload hazard.`,
    });
  } else if (temp <= ANTARCTIC_THRESHOLDS.COLD_CRITICAL_C || apparentTemp <= ANTARCTIC_THRESHOLDS.WIND_CHILL_CRITICAL_C) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-cold-critical`,
      type: "EXTREME_COLD",
      title: "Extreme Cold Event",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${temp.toFixed(1)}°C`,
      description: `Extreme environmental chill at ${temp.toFixed(1)}°C (Wind chill: ${apparentTemp.toFixed(1)}°C). Frostbite risk in under 5 minutes outdoors.`,
    });
  } else if (temp <= ANTARCTIC_THRESHOLDS.COLD_WARNING_C) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-cold-warning`,
      type: "EXTREME_COLD",
      title: "Cold Warning",
      severity: "WARNING",
      station: stationId,
      stationName,
      timestamp,
      metric: `${temp.toFixed(1)}°C`,
      description: `Sub-zero temperature dropped to ${temp.toFixed(1)}°C. Generator fuel viscosity heating systems engaged.`,
    });
  }

  // 3. Rapid Pressure Drop Detection
  const pressureDelta = previousWeather ? Number(previousWeather.surfacePressureHPa ?? pressure) - pressure : 0;
  const isRapidDrop = pressureDelta >= ANTARCTIC_THRESHOLDS.PRESSURE_DROP_DELTA_HPA;

  if (pressure <= ANTARCTIC_THRESHOLDS.PRESSURE_CYCLONE_HPA || (isRapidDrop && pressure < 975)) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-pressure-critical`,
      type: "PRESSURE_DROP",
      title: "Rapid Pressure Drop",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${pressure.toFixed(1)} hPa${isRapidDrop ? ` (-${pressureDelta.toFixed(1)} hPa)` : ""}`,
      description: `Severe barometric depression plunging to ${pressure.toFixed(1)} hPa. Deep polar cyclone front entering station operational sector.`,
    });
  } else if (pressure <= ANTARCTIC_THRESHOLDS.PRESSURE_DEPRESSION_HPA || isRapidDrop) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-pressure-warning`,
      type: "PRESSURE_DROP",
      title: "Rapid Pressure Drop",
      severity: "WARNING",
      station: stationId,
      stationName,
      timestamp,
      metric: `${pressure.toFixed(1)} hPa${isRapidDrop ? ` (-${pressureDelta.toFixed(1)} hPa)` : ""}`,
      description: `Steep barometric trough detected at ${pressure.toFixed(1)} hPa. Low-pressure weather system closing in.`,
    });
  }

  // 4. Severe Weather Alert Detection
  // Combinations indicating blizzard conditions or severe precipitation codes
  const isBlizzardCondition = (windSpeed >= 40 && temp <= -20) || (windSpeed >= 30 && temp <= -30);
  const isSevereWmoCode = [73, 75, 77, 82, 85, 86, 95, 96, 99].includes(code);

  if (isBlizzardCondition && isSevereWmoCode) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-severe-critical`,
      type: "SEVERE_WEATHER",
      title: "Severe Weather Alert",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `${condition.toUpperCase()} / ${windSpeed.toFixed(0)} km/h`,
      description: `Active polar blizzard: ${condition} with ${windSpeed.toFixed(0)} km/h winds and ${temp.toFixed(1)}°C cold. Full shelter protocol in force.`,
    });
  } else if (isBlizzardCondition) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-severe-blizzard`,
      type: "SEVERE_WEATHER",
      title: "Severe Weather Alert",
      severity: "CRITICAL",
      station: stationId,
      stationName,
      timestamp,
      metric: `BLIZZARD THREAT (${windSpeed.toFixed(0)} km/h)`,
      description: `Blizzard envelope active: sustained winds of ${windSpeed.toFixed(0)} km/h combined with severe sub-zero cold (${temp.toFixed(1)}°C).`,
    });
  } else if (isSevereWmoCode) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-severe-code`,
      type: "SEVERE_WEATHER",
      title: "Severe Weather Alert",
      severity: "WARNING",
      station: stationId,
      stationName,
      timestamp,
      metric: condition.toUpperCase(),
      description: `Severe meteorological condition reported: ${condition} (WMO ${code}). Visibility and logistics compromised.`,
    });
  }

  // If no critical/warning event was flagged, emit a nominal baseline log to maintain continuous awareness
  if (events.length === 0) {
    events.push({
      id: `evt-${stationId.toLowerCase()}-${now.getTime()}-nominal`,
      type: "NOMINAL",
      title: "Nominal Meteorological State",
      severity: "INFO",
      station: stationId,
      stationName,
      timestamp,
      metric: `${temp.toFixed(1)}°C / ${windSpeed.toFixed(0)} km/h`,
      description: `Atmospheric envelope within standard Antarctic baseline: ${condition}, ${temp.toFixed(1)}°C, wind ${windSpeed.toFixed(0)} km/h, pressure ${pressure.toFixed(0)} hPa.`,
    });
  }

  return events;
}

/**
 * Returns initial realistic Antarctic background events so the timeline
 * has immediate context for both stations on boot.
 */
export function getInitialHistoricalEvents() {
  const t0 = Date.now();
  return [
    {
      id: "evt-init-01-maitri",
      type: "PRESSURE_DROP",
      title: "Rapid Pressure Drop",
      severity: "WARNING",
      station: "MAITRI",
      stationName: "Maitri Station",
      timestamp: new Date(t0 - 18 * 60 * 1000).toISOString(),
      metric: "968.6 hPa",
      description: "Steep barometric trough detected at 968.6 hPa. Low-pressure weather system closing in over Schirmacher Oasis.",
    },
    {
      id: "evt-init-02-maitri",
      type: "HIGH_WIND",
      title: "Katabatic Wind Advisory",
      severity: "WARNING",
      station: "MAITRI",
      stationName: "Maitri Station",
      timestamp: new Date(t0 - 32 * 60 * 1000).toISOString(),
      metric: "27.2 km/h",
      description: "Elevated katabatic wind flow observed at 27.2 km/h (SE). Surface drift active across station perimeter.",
    },
    {
      id: "evt-init-03-bharati",
      type: "NOMINAL",
      title: "Nominal Meteorological State",
      severity: "INFO",
      station: "BHARATI",
      stationName: "Bharati Station",
      timestamp: new Date(t0 - 45 * 60 * 1000).toISOString(),
      metric: "-16.8°C / 5 km/h",
      description: "Clear sky and light breeze at Larsemann Hills. Station generating capacity nominal at baseline envelope.",
    },
    {
      id: "evt-init-04-bharati",
      type: "EXTREME_COLD",
      title: "Cold Warning",
      severity: "WARNING",
      station: "BHARATI",
      stationName: "Bharati Station",
      timestamp: new Date(t0 - 75 * 60 * 1000).toISOString(),
      metric: "-24.2°C",
      description: "Night-time radiative heat loss dropped ambient to -24.2°C. Fuel pre-heating advisory dispatched.",
    },
  ];
}

/**
 * Merges newly detected events into an existing timeline:
 * - Eliminates duplicate events
 * - Sorts newest events first
 * - Enforces maximum history size
 */
export function mergeWeatherEvents(existingEvents = [], newEvents = [], maxCount = 30) {
  const seenIds = new Set();
  const merged = [];

  // Add new events first
  for (const evt of newEvents) {
    if (!seenIds.has(evt.id)) {
      seenIds.add(evt.id);
      merged.push(evt);
    }
  }

  // Append existing events
  for (const evt of existingEvents) {
    if (!seenIds.has(evt.id)) {
      seenIds.add(evt.id);
      merged.push(evt);
    }
  }

  // Sort strictly by timestamp descending (newest first)
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return merged.slice(0, maxCount);
}

export default {
  ANTARCTIC_THRESHOLDS,
  detectWeatherEvents,
  getInitialHistoricalEvents,
  mergeWeatherEvents,
};
