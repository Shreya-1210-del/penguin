// services/riskEngine.js — Polar Risk Assessment Engine
// Evaluates real-time meteorological data to compute Operational, Personnel, and Equipment risks

export const RISK_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export const RISK_COLORS = {
  LOW: "#2ed6a1",       // var(--green)
  MEDIUM: "#52bfff",    // var(--cyan)
  HIGH: "#f4b64b",      // var(--amber)
  CRITICAL: "#ff5d69",  // var(--red)
};

/**
 * Evaluates Personnel Risk based on wind chill, ambient temperature, and wind speed.
 * Concerns: frostbite times, hypothermia, whiteout disorientation, exterior movement safety.
 */
export function evaluatePersonnelRisk(weather) {
  if (!weather) {
    return {
      level: RISK_LEVELS.LOW,
      score: 15,
      color: RISK_COLORS.LOW,
      label: "LOW",
      title: "Personnel Risk",
      advisory: "Standard polar exposure protocols active. Routine exterior movements permitted.",
      factors: ["Baseline cold conditions", "Light surface wind velocity"],
    };
  }

  const temp = Number(weather.temperature ?? -20);
  const apparentTemp = Number(weather.apparentTemperature ?? temp);
  const wind = Number(weather.windSpeedKmH ?? 0);

  let score = 0;
  const factors = [];

  // Wind chill contribution (up to 60 pts)
  if (apparentTemp <= -45) {
    score += 60;
    factors.push(`Severe wind chill: ${apparentTemp.toFixed(1)}°C (< 2 min frostbite window)`);
  } else if (apparentTemp <= -35) {
    score += 42;
    factors.push(`Deep wind chill: ${apparentTemp.toFixed(1)}°C (< 10 min frostbite hazard)`);
  } else if (apparentTemp <= -25) {
    score += 26;
    factors.push(`Cold wind chill: ${apparentTemp.toFixed(1)}°C (Face protection mandatory)`);
  } else {
    score += 10;
    factors.push(`Mild chill: ${apparentTemp.toFixed(1)}°C`);
  }

  // Wind velocity contribution (up to 40 pts)
  if (wind >= 60) {
    score += 40;
    factors.push(`Severe gale ${wind.toFixed(0)} km/h (Loss of footing & tether risk)`);
  } else if (wind >= 40) {
    score += 28;
    factors.push(`High wind ${wind.toFixed(0)} km/h (Zero-visibility snow drift)`);
  } else if (wind >= 25) {
    score += 16;
    factors.push(`Brisk wind ${wind.toFixed(0)} km/h`);
  } else {
    score += 5;
    factors.push(`Light breeze ${wind.toFixed(0)} km/h`);
  }

  score = Math.min(100, Math.max(0, score));

  let level = RISK_LEVELS.LOW;
  let advisory = "Standard polar clothing required. Routine station tasks safe.";

  if (score >= 75 || apparentTemp <= -45 || wind >= 65) {
    level = RISK_LEVELS.CRITICAL;
    advisory = "EMERGENCY: Immediate frostbite threat. Complete station lockdown & all sorties halted.";
  } else if (score >= 50 || apparentTemp <= -35 || wind >= 45) {
    level = RISK_LEVELS.HIGH;
    advisory = "HIGH RISK: Exposed skin freezes in < 10 min. All non-essential outdoor work cancelled.";
  } else if (score >= 30 || apparentTemp <= -25 || wind >= 25) {
    level = RISK_LEVELS.MEDIUM;
    advisory = "CAUTION: Outdoor exposure limited to 45 min. Buddy system and radio check-in active.";
  }

  return {
    level,
    score,
    color: RISK_COLORS[level],
    label: level,
    title: "Personnel Risk",
    advisory,
    factors,
  };
}

/**
 * Evaluates Equipment Risk based on temperature, relative humidity, and structural wind stress.
 * Concerns: diesel fuel gelling/viscosity, generator radiator icing, antenna mechanical strain.
 */
export function evaluateEquipmentRisk(weather) {
  if (!weather) {
    return {
      level: RISK_LEVELS.LOW,
      score: 18,
      color: RISK_COLORS.LOW,
      label: "LOW",
      title: "Equipment Risk",
      advisory: "Generating units and fuel lines within nominal operational envelope.",
      factors: ["Normal fuel viscosity", "No radiator icing detected"],
    };
  }

  const temp = Number(weather.temperature ?? -20);
  const wind = Number(weather.windSpeedKmH ?? 0);
  const humidity = Number(weather.relativeHumidity ?? 50);

  let score = 0;
  const factors = [];

  // Low temperature fuel viscosity risk (up to 55 pts)
  if (temp <= -45) {
    score += 55;
    factors.push(`Extreme cold ${temp.toFixed(1)}°C (Severe diesel wax crystallization hazard)`);
  } else if (temp <= -35) {
    score += 38;
    factors.push(`Cold stress ${temp.toFixed(1)}°C (Viscosity thickening; thermal circulation active)`);
  } else if (temp <= -25) {
    score += 22;
    factors.push(`Sub-zero ${temp.toFixed(1)}°C (Fuel pre-heaters operating)`);
  } else {
    score += 8;
    factors.push(`Optimal thermal baseline ${temp.toFixed(1)}°C`);
  }

  // Wind structural stress (up to 30 pts)
  if (wind >= 70) {
    score += 30;
    factors.push(`Severe gust stress ${wind.toFixed(0)} km/h on antenna mast & exhaust cowls`);
  } else if (wind >= 45) {
    score += 20;
    factors.push(`Elevated dynamic wind pressure ${wind.toFixed(0)} km/h`);
  } else if (wind >= 25) {
    score += 10;
    factors.push(`Moderate airflow ${wind.toFixed(0)} km/h`);
  } else {
    score += 4;
  }

  // Radiator / Intake icing risk from humidity + cold (up to 15 pts)
  if (humidity >= 80 && temp <= -15) {
    score += 15;
    factors.push(`High humidity ${humidity}% causing rime ice buildup on generator air louvers`);
  } else if (humidity >= 65 && temp <= -20) {
    score += 10;
    factors.push(`Moisture accretion watch (${humidity}%)`);
  } else {
    score += 3;
  }

  score = Math.min(100, Math.max(0, score));

  let level = RISK_LEVELS.LOW;
  let advisory = "Diesel generators operating nominal. Thermal efficiency within baseline.";

  if (score >= 75 || temp <= -45 || wind >= 75) {
    level = RISK_LEVELS.CRITICAL;
    advisory = "CRITICAL: Fuel crystallization & generator trip hazard. Secondary unit spin-up mandatory.";
  } else if (score >= 50 || temp <= -35 || wind >= 50) {
    level = RISK_LEVELS.HIGH;
    advisory = "HIGH RISK: Radiator louvers cycling. Continuous viscosity trace heating engaged.";
  } else if (score >= 30 || temp <= -25 || (humidity >= 80 && temp <= -15)) {
    level = RISK_LEVELS.MEDIUM;
    advisory = "MODERATE: Fuel heating loops active. Inspect exterior intake filters for snow accumulation.";
  }

  return {
    level,
    score,
    color: RISK_COLORS[level],
    label: level,
    title: "Equipment Risk",
    advisory,
    factors,
  };
}

/**
 * Evaluates Operational Risk based on barometric pressure stability, blizzard envelopes, and logistics.
 * Concerns: supply routes, helicopter/skidoo traverse, satellite antenna tracking, mission continuity.
 */
export function evaluateOperationalRisk(weather) {
  if (!weather) {
    return {
      level: RISK_LEVELS.LOW,
      score: 12,
      color: RISK_COLORS.LOW,
      label: "LOW",
      title: "Operational Risk",
      advisory: "Logistics corridors open. Communication links clear.",
      factors: ["Stable polar anticyclone", "High visibility"],
    };
  }

  const pressure = Number(weather.surfacePressureHPa ?? 990);
  const wind = Number(weather.windSpeedKmH ?? 0);
  const temp = Number(weather.temperature ?? -20);
  const code = weather.weatherCode;

  let score = 0;
  const factors = [];

  // Barometric pressure depression (up to 45 pts)
  if (pressure <= 955) {
    score += 45;
    factors.push(`Deep polar depression ${pressure.toFixed(1)} hPa (Cyclonic storm front)`);
  } else if (pressure <= 968) {
    score += 32;
    factors.push(`Barometric trough ${pressure.toFixed(1)} hPa (Low-pressure advance)`);
  } else if (pressure <= 980) {
    score += 18;
    factors.push(`Mild pressure depression ${pressure.toFixed(1)} hPa`);
  } else {
    score += 6;
    factors.push(`Stable anticyclone ${pressure.toFixed(1)} hPa`);
  }

  // Combined Blizzard / Visibility impact (up to 40 pts)
  const isBlizzard = (wind >= 40 && temp <= -20) || (wind >= 30 && temp <= -30);
  if (isBlizzard) {
    score += 40;
    factors.push(`Blizzard envelope confirmed (${wind.toFixed(0)} km/h wind + ${temp.toFixed(1)}°C cold)`);
  } else if (wind >= 35) {
    score += 24;
    factors.push(`Blowing drift snow (${wind.toFixed(0)} km/h) impacting traverse routes`);
  } else if (wind >= 20) {
    score += 12;
  } else {
    score += 4;
  }

  // Severe WMO weather code (up to 15 pts)
  if ([73, 75, 77, 85, 86, 95, 96, 99].includes(code)) {
    score += 15;
    factors.push(`Severe precipitation: ${weather.weatherCondition || "Snowfall"}`);
  } else {
    score += 2;
  }

  score = Math.min(100, Math.max(0, score));

  let level = RISK_LEVELS.LOW;
  let advisory = "Field traverse, helicopter flights, and satellite telemetry links fully nominal.";

  if (score >= 75 || (isBlizzard && wind >= 55) || pressure <= 955) {
    level = RISK_LEVELS.CRITICAL;
    advisory = "CRITICAL: Total operational cessation. SatSync priority delta telemetry mode enforced.";
  } else if (score >= 50 || isBlizzard || pressure <= 968) {
    level = RISK_LEVELS.HIGH;
    advisory = "HIGH RISK: All overland traverse suspended. Satellite dish wind deflection watch active.";
  } else if (score >= 30 || wind >= 30 || pressure <= 980) {
    level = RISK_LEVELS.MEDIUM;
    advisory = "MODERATE: Flights and long-range skidoo runs delayed. Local field communications monitored.";
  }

  return {
    level,
    score,
    color: RISK_COLORS[level],
    label: level,
    title: "Operational Risk",
    advisory,
    factors,
  };
}

/**
 * Master risk evaluator generating Operational, Personnel, and Equipment risks
 * from normalized Antarctic station weather data.
 *
 * @param {object} weather - Normalized weather object
 * @returns {object} Comprehensive risk assessment
 */
export function assessStationRisk(weather) {
  const personnel = evaluatePersonnelRisk(weather);
  const equipment = evaluateEquipmentRisk(weather);
  const operational = evaluateOperationalRisk(weather);

  // Compute composite station risk level (highest severity takes precedence)
  const severityRank = {
    [RISK_LEVELS.LOW]: 1,
    [RISK_LEVELS.MEDIUM]: 2,
    [RISK_LEVELS.HIGH]: 3,
    [RISK_LEVELS.CRITICAL]: 4,
  };

  const highestRank = Math.max(
    severityRank[personnel.level],
    severityRank[equipment.level],
    severityRank[operational.level]
  );

  const overallRiskLevel = Object.keys(severityRank).find(
    (key) => severityRank[key] === highestRank
  ) || RISK_LEVELS.LOW;

  const averageScore = Math.round((personnel.score + equipment.score + operational.score) / 3);

  return {
    operational,
    personnel,
    equipment,
    overallRiskLevel,
    averageScore,
    color: RISK_COLORS[overallRiskLevel],
    stationId: weather?.stationId || "BHARATI",
    stationName: weather?.stationName || "Bharati Station",
    timestamp: weather?.fetchedAt || new Date().toISOString(),
  };
}

export default {
  RISK_LEVELS,
  RISK_COLORS,
  evaluatePersonnelRisk,
  evaluateEquipmentRisk,
  evaluateOperationalRisk,
  assessStationRisk,
};
