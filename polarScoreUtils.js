// polarScoreUtils.js — Polar Condition Score Algorithm
// Mathematical formulation for Antarctic environmental severity scoring

/**
 * Calculates the Polar Condition Score (0-100) from meteorological inputs.
 *
 * Formulations:
 * - Temperature Subscore (40% weight): Range -10°C (ideal polar baseline, 100 pts)
 *   down to -55°C (emergency blizzard threshold, 0 pts).
 * - Wind Speed Subscore (30% weight): Range 0-10 km/h (calm, 100 pts)
 *   down to 80 km/h (severe katabatic blizzard gale, 0 pts).
 * - Surface Pressure Subscore (20% weight): Range 990-1025 hPa (stable polar anticyclone, 100 pts)
 *   down to 945 hPa (deep low-pressure storm depression, 0 pts).
 * - Relative Humidity Subscore (10% weight): Range 25-65% (ideal dry polar desert, 100 pts)
 *   penalized down to 20 pts when > 65% (whiteout, heavy rime icing risk).
 *
 * Statuses:
 * - 80-100 = Optimal
 * - 60-79  = Stable
 * - 40-59  = Warning
 * - 20-39  = High Risk
 * - 0-19   = Critical
 */
export function calculatePolarScore({
  temperature = -20,
  windSpeed = 15,
  humidity = 50,
  pressure = 990,
} = {}) {
  const t = Number(temperature);
  const w = Number(windSpeed);
  const h = Number(humidity);
  const p = Number(pressure);

  // 1. Temperature subscore (Weight: 40%)
  // -10°C or warmer in Antarctica is optimal (100).
  // -55°C or colder is critical blizzard severity (0).
  const tempScore = Math.max(0, Math.min(100, ((t + 55) / 45) * 100));

  // 2. Wind speed subscore (Weight: 30%)
  // Up to 10 km/h is calm (100).
  // Scaled down to 0 at 80 km/h.
  const windScore = Math.max(0, Math.min(100, 100 - (Math.max(0, w - 10) / 70) * 100));

  // 3. Pressure subscore (Weight: 20%)
  // 990 hPa is standard stable polar pressure (100).
  // Drops below 990 down to 945 hPa (0).
  let pressureScore = 100;
  if (p < 990) {
    pressureScore = Math.max(0, Math.min(100, ((p - 945) / 45) * 100));
  } else if (p > 1030) {
    pressureScore = Math.max(70, 100 - (p - 1030) * 2);
  }

  // 4. Humidity subscore (Weight: 10%)
  // Below 65% humidity in polar desert is optimal (100).
  // Above 65% increases icing and whiteout risk.
  let humidityScore = 100;
  if (h > 65) {
    humidityScore = Math.max(20, Math.min(100, 100 - ((h - 65) / 30) * 60));
  } else if (h < 15) {
    humidityScore = Math.max(80, 100 - (15 - h) * 2);
  }

  // Weighted composite score
  const weightedTotal =
    tempScore * 0.40 +
    windScore * 0.30 +
    pressureScore * 0.20 +
    humidityScore * 0.10;

  const score = Math.round(Math.max(0, Math.min(100, weightedTotal)));

  // Output status mapping according to requirements
  let status = "Critical";
  let tone = "critical";
  let color = "#ff5d69"; // var(--red)

  if (score >= 80) {
    status = "Optimal";
    tone = "optimal";
    color = "#2ed6a1"; // var(--green)
  } else if (score >= 60) {
    status = "Stable";
    tone = "stable";
    color = "#52bfff"; // var(--cyan)
  } else if (score >= 40) {
    status = "Warning";
    tone = "warning";
    color = "#f4b64b"; // var(--amber)
  } else if (score >= 20) {
    status = "High Risk";
    tone = "high-risk";
    color = "#ff914d"; // orange
  } else {
    status = "Critical";
    tone = "critical";
    color = "#ff5d69"; // var(--red)
  }

  return {
    score,
    status,
    tone,
    color,
    components: {
      temperature: { value: t, score: Math.round(tempScore), weight: 0.40 },
      windSpeed: { value: w, score: Math.round(windScore), weight: 0.30 },
      pressure: { value: p, score: Math.round(pressureScore), weight: 0.20 },
      humidity: { value: h, score: Math.round(humidityScore), weight: 0.10 },
    },
  };
}

/**
 * Convenience helper to calculate score from a normalized weather object.
 */
export function getPolarScoreFromWeather(weather) {
  if (!weather) {
    return calculatePolarScore({
      temperature: -20,
      windSpeed: 15,
      humidity: 50,
      pressure: 990,
    });
  }

  return calculatePolarScore({
    temperature: weather.temperature,
    windSpeed: weather.windSpeedKmH ?? (weather.windSpeedMs ? weather.windSpeedMs * 3.6 : 15),
    humidity: weather.relativeHumidity,
    pressure: weather.surfacePressureHPa,
  });
}

export default {
  calculatePolarScore,
  getPolarScoreFromWeather,
};
