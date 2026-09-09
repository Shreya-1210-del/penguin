// services/weatherImpactEngine.js — Weather Impact Engine
// Connects real-time meteorological conditions to Antarctic station operations:
// Power Demand, Communication Reliability, Equipment Stress, Outdoor Operation Availability.

import { assessStationRisk, RISK_LEVELS } from "./riskEngine.js";
import { detectWeatherEvents } from "../weatherEvents.js";

export const IMPACT_STATUS = {
  NORMAL: "NORMAL",
  WATCH: "WATCH",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
};

export const IMPACT_COLORS = {
  NORMAL: "#2ed6a1",   // var(--green)
  WATCH: "#52bfff",    // var(--cyan)
  WARNING: "#f4b64b",  // var(--amber)
  CRITICAL: "#ff5d69", // var(--red)
};

const SEVERITY_RANK = {
  [IMPACT_STATUS.NORMAL]: 1,
  [IMPACT_STATUS.WATCH]: 2,
  [IMPACT_STATUS.WARNING]: 3,
  [IMPACT_STATUS.CRITICAL]: 4,
};

/**
 * Evaluates Power Demand based on base load + thermal HVAC heating + trace heating + wind chill convection.
 *
 * @param {object} params - Weather inputs
 * @param {number} params.temp - Ambient temperature (°C)
 * @param {number} params.wind - Wind speed (km/h)
 * @param {number} params.humidity - Relative humidity (%)
 * @param {number} params.pressure - Surface pressure (hPa)
 * @returns {object} Power Demand assessment
 */
export function evaluatePowerDemand({ temp, wind, humidity, pressure }) {
  const baseKW = 48.0; // Base baseline station draw (lighting, science, air handling)
  let heatingKW = 0;
  const factors = [];

  // Cold Weather Heating Multipliers
  if (temp <= -45) {
    heatingKW += 52;
    factors.push(`Severe thermal deficit (${temp.toFixed(1)}°C): Emergency tank immersion heaters active`);
  } else if (temp <= -35) {
    heatingKW += 38;
    factors.push(`Deep sub-zero chill (${temp.toFixed(1)}°C): Full pipeline trace-heating coils engaged`);
  } else if (temp <= -25) {
    heatingKW += 24;
    factors.push(`Sub-zero cold (${temp.toFixed(1)}°C): Habitat convective HVAC heating elevated`);
  } else if (temp <= -15) {
    heatingKW += 12;
    factors.push(`Moderate cold (${temp.toFixed(1)}°C): Secondary heating loops running`);
  } else {
    heatingKW += 4;
    factors.push(`Mild polar ambient (${temp.toFixed(1)}°C): Baseline thermal loop`);
  }

  // Wind Convective Heat Stripping (higher wind strips exterior module insulation)
  let windConvectionKW = 0;
  if (wind >= 50) {
    windConvectionKW = 18;
    factors.push(`High katabatic wind (${wind.toFixed(0)} km/h): Structural envelope heat loss surge`);
  } else if (wind >= 30) {
    windConvectionKW = 10;
    factors.push(`Moderate wind (${wind.toFixed(0)} km/h): Enhanced building convective cooling`);
  } else if (wind >= 15) {
    windConvectionKW = 4;
  }

  // High humidity icing adds minor load for intake/antenna de-icing heaters
  let deicingKW = 0;
  if (humidity >= 80 && temp <= -10) {
    deicingKW = 6;
    factors.push(`Rime ice prevention: Radome and air louver heater mats active (+6 kW)`);
  }

  const estimatedDemandKW = Math.round((baseKW + heatingKW + windConvectionKW + deicingKW) * 10) / 10;
  const loadIncreasePercent = Math.round(((estimatedDemandKW - baseKW) / baseKW) * 100);

  let status = IMPACT_STATUS.NORMAL;
  let advisory = "Station power draw within single-generator nominal envelope. Fuel burn optimal.";

  if (estimatedDemandKW >= 96 || temp <= -45 || (temp <= -35 && wind >= 50)) {
    status = IMPACT_STATUS.CRITICAL;
    advisory = "CRITICAL: Generator load exceeds 85% capacity. Spin up secondary generator immediately.";
  } else if (estimatedDemandKW >= 78 || temp <= -35 || (temp <= -25 && wind >= 40)) {
    status = IMPACT_STATUS.WARNING;
    advisory = "WARNING: Heavy electrical draw. Secondary generator on hot-standby; shed non-essential loads.";
  } else if (estimatedDemandKW >= 62 || temp <= -22 || wind >= 30) {
    status = IMPACT_STATUS.WATCH;
    advisory = "WATCH: Elevated heating demand. Monitor fuel supply manifold temperature closely.";
  }

  return {
    id: "power-demand",
    label: "Power Demand",
    status,
    color: IMPACT_COLORS[status],
    value: `${estimatedDemandKW.toFixed(1)} kW`,
    metricValue: estimatedDemandKW,
    unit: "kW",
    baselineKW: baseKW,
    loadIncreasePercent,
    subtext: `+${loadIncreasePercent}% over baseline (${baseKW} kW)`,
    advisory,
    factors,
  };
}

/**
 * Evaluates Communication Reliability based on wind buffeting, antenna deflection,
 * rime ice attenuation, and barometric storm disturbances.
 *
 * @param {object} params - Weather inputs
 * @returns {object} Communication Reliability assessment
 */
export function evaluateCommunicationReliability({ temp, wind, humidity, pressure }) {
  let penalty = 0;
  const factors = [];

  // Wind buffeting & dish mechanical deflection
  if (wind >= 70) {
    penalty += 45;
    factors.push(`Gale force winds (${wind.toFixed(0)} km/h): Extreme antenna deflection; stow protocol`);
  } else if (wind >= 50) {
    penalty += 26;
    factors.push(`High wind buffeting (${wind.toFixed(0)} km/h): Gimbal servo tracking flutter`);
  } else if (wind >= 35) {
    penalty += 12;
    factors.push(`Brisk wind (${wind.toFixed(0)} km/h): Minor parabolic dish azimuth drift`);
  } else {
    factors.push(`Stable wind velocity (${wind.toFixed(0)} km/h): Precise antenna tracking`);
  }

  // Radome icing & moisture attenuation
  if (humidity >= 80 && temp <= -10) {
    penalty += 22;
    factors.push(`High humidity (${humidity}%) & freeze (${temp.toFixed(1)}°C): Heavy dielectric rime loss`);
  } else if (humidity >= 70 && temp <= -15) {
    penalty += 10;
    factors.push(`Moisture freezing on feed horn radome: -2.5 dB attenuation`);
  }

  // Barometric cyclonic front / storm tropospheric clutter
  if (pressure <= 955) {
    penalty += 18;
    factors.push(`Deep cyclonic trough (${pressure.toFixed(1)} hPa): Severe atmospheric signal fade`);
  } else if (pressure <= 968) {
    penalty += 8;
    factors.push(`Low pressure system (${pressure.toFixed(1)} hPa): Minor tropospheric scatter`);
  }

  const reliabilityPercent = Math.max(8, Math.min(100, 100 - penalty));
  const signalMarginDb = Math.max(1.2, Math.round((14.5 * (reliabilityPercent / 100)) * 10) / 10);

  let status = IMPACT_STATUS.NORMAL;
  let mode = "HIGH SPEED BROADBAND";
  let advisory = "SATCOM link nominal. Full bidirectional scientific and operator telemetry open.";

  if (reliabilityPercent < 45 || wind >= 65 || (humidity >= 85 && temp <= -20)) {
    status = IMPACT_STATUS.CRITICAL;
    mode = "SATSYNC DELTA ONLY";
    advisory = "CRITICAL: Satellite link severely compromised. Enforce SatSync delta compression mode.";
  } else if (reliabilityPercent < 65 || wind >= 45 || (humidity >= 80 && temp <= -15)) {
    status = IMPACT_STATUS.WARNING;
    mode = "COMPACT TELEMETRY";
    advisory = "WARNING: Link jitter and packet drops detected. Prioritize mission-critical channels.";
  } else if (reliabilityPercent < 85 || wind >= 30 || pressure <= 972) {
    status = IMPACT_STATUS.WATCH;
    mode = "STANDARD CARRIER";
    advisory = "WATCH: Elevated dish vibration. Standby for low-bandwidth protocol switchover.";
  }

  return {
    id: "communication-reliability",
    label: "Communication Reliability",
    status,
    color: IMPACT_COLORS[status],
    value: `${reliabilityPercent}%`,
    metricValue: reliabilityPercent,
    unit: "%",
    signalMarginDb: `+${signalMarginDb.toFixed(1)} dB`,
    mode,
    subtext: `${mode} (Link Margin: +${signalMarginDb.toFixed(1)} dB)`,
    advisory,
    factors,
  };
}

/**
 * Evaluates Equipment Stress based on sub-zero lubrication viscosity,
 * structural dynamic wind stress, and air intake icing.
 *
 * @param {object} params - Weather inputs
 * @returns {object} Equipment Stress assessment
 */
export function evaluateEquipmentStress({ temp, wind, humidity, pressure }) {
  let stressScore = 0;
  const factors = [];

  // Low temperature viscosity & metal brittleness
  if (temp <= -45) {
    stressScore += 50;
    factors.push(`Severe freeze (${temp.toFixed(1)}°C): Fuel wax crystallization; metal embrittlement`);
  } else if (temp <= -35) {
    stressScore += 35;
    factors.push(`Deep cold (${temp.toFixed(1)}°C): Lubricant thickening; hydraulic valve sluggishness`);
  } else if (temp <= -25) {
    stressScore += 20;
    factors.push(`Cold stress (${temp.toFixed(1)}°C): Trace heat recirculation required`);
  } else if (temp <= -15) {
    stressScore += 10;
  } else {
    stressScore += 4;
  }

  // Wind dynamic pressure on exhaust stacks, cranes, antenna masts
  if (wind >= 70) {
    stressScore += 35;
    factors.push(`Severe gale (${wind.toFixed(0)} km/h): Heavy mast resonance & structural fatigue`);
  } else if (wind >= 50) {
    stressScore += 22;
    factors.push(`High wind (${wind.toFixed(0)} km/h): Exhaust cowl vibration; elevated shear stress`);
  } else if (wind >= 30) {
    stressScore += 10;
    factors.push(`Moderate airflow (${wind.toFixed(0)} km/h): Structural mounts stable`);
  } else {
    stressScore += 3;
  }

  // Generator combustion air intake louvers icing
  if (humidity >= 80 && temp <= -15) {
    stressScore += 15;
    factors.push(`Rime icing risk: Intake screen ice buildup choking generator combustion air`);
  } else if (humidity >= 70 && temp <= -20) {
    stressScore += 8;
  }

  stressScore = Math.min(100, Math.max(0, stressScore));

  let status = IMPACT_STATUS.NORMAL;
  let advisory = "All mechanical and generation equipment running within normal tolerances.";

  if (stressScore >= 70 || temp <= -45 || wind >= 70) {
    status = IMPACT_STATUS.CRITICAL;
    advisory = "CRITICAL: Extreme mechanical strain. Inspect intake louvers, engage generator pre-warming.";
  } else if (stressScore >= 48 || temp <= -35 || wind >= 48) {
    status = IMPACT_STATUS.WARNING;
    advisory = "WARNING: Elevated mechanical stress. Verify fuel pre-heaters and mast guide wire tension.";
  } else if (stressScore >= 28 || temp <= -25 || wind >= 28) {
    status = IMPACT_STATUS.WATCH;
    advisory = "WATCH: Low temperatures affecting lubricant viscosity. Maintain trace heating circuits.";
  }

  return {
    id: "equipment-stress",
    label: "Equipment Stress",
    status,
    color: IMPACT_COLORS[status],
    value: `${stressScore}%`,
    metricValue: stressScore,
    unit: "%",
    subtext: `Mechanical Index: ${stressScore}/100`,
    advisory,
    factors,
  };
}

/**
 * Evaluates Outdoor Operation Availability based on wind chill frostbite limits,
 * zero-visibility drift snow, and barometric storm approach.
 *
 * @param {object} params - Weather inputs
 * @param {number} [params.apparentTemp] - Apparent temperature / wind chill (°C)
 * @returns {object} Outdoor Operation Availability assessment
 */
export function evaluateOutdoorOperationAvailability({ temp, wind, humidity, pressure, apparentTemp = temp }) {
  let penalty = 0;
  const factors = [];

  // Wind chill & Frostbite hazard
  if (apparentTemp <= -45) {
    penalty += 55;
    factors.push(`Extreme wind chill (${apparentTemp.toFixed(1)}°C): Frostbite in < 2 minutes on exposed skin`);
  } else if (apparentTemp <= -35) {
    penalty += 36;
    factors.push(`Severe wind chill (${apparentTemp.toFixed(1)}°C): Frostbite in < 10 minutes`);
  } else if (apparentTemp <= -25) {
    penalty += 20;
    factors.push(`Deep cold (${apparentTemp.toFixed(1)}°C): Full polar balaclavas and thermal suits required`);
  } else {
    factors.push(`Nominal polar temperature (${apparentTemp.toFixed(1)}°C)`);
  }

  // Katabatic wind & whiteout footing hazards
  if (wind >= 60) {
    penalty += 45;
    factors.push(`Severe gale (${wind.toFixed(0)} km/h): Zero-visibility ground blizzard; loss of footing`);
  } else if (wind >= 40) {
    penalty += 26;
    factors.push(`High wind (${wind.toFixed(0)} km/h): Blowing drift snow; disorientation hazard`);
  } else if (wind >= 25) {
    penalty += 12;
    factors.push(`Moderate breeze (${wind.toFixed(0)} km/h): Safety tether advisory`);
  }

  // Approaching polar cyclone
  if (pressure <= 958) {
    penalty += 25;
    factors.push(`Cyclonic depression (${pressure.toFixed(1)} hPa): Recall all field and traverse parties`);
  } else if (pressure <= 970) {
    penalty += 12;
    factors.push(`Barometric trough (${pressure.toFixed(1)} hPa): Weather deterioration imminent`);
  }

  const availabilityPercent = Math.max(0, Math.min(100, 100 - penalty));

  let status = IMPACT_STATUS.NORMAL;
  let windowDuration = "ROUTINE (UNLIMITED)";
  let traverseCorridor = "ALL CORRIDORS OPEN";
  let advisory = "Exterior operations permitted. Standard station safety protocols active.";

  if (availabilityPercent < 25 || apparentTemp <= -45 || wind >= 55 || pressure <= 958) {
    status = IMPACT_STATUS.CRITICAL;
    windowDuration = "0 MIN — LOCKDOWN";
    traverseCorridor = "ALL TRAVERSE HALTED";
    advisory = "CRITICAL: Complete station lockdown. All field sorties, traverse runs, and outdoor tasks forbidden.";
  } else if (availabilityPercent < 50 || apparentTemp <= -35 || wind >= 42 || pressure <= 968) {
    status = IMPACT_STATUS.WARNING;
    windowDuration = "MAX 15 MIN (TETHERED)";
    traverseCorridor = "EMERGENCY SORTIES ONLY";
    advisory = "WARNING: Outdoor movement restricted to essential station survival tasks with safety tethers.";
  } else if (availabilityPercent < 75 || apparentTemp <= -25 || wind >= 28 || pressure <= 978) {
    status = IMPACT_STATUS.WATCH;
    windowDuration = "MAX 45-60 MIN (BUDDY)";
    traverseCorridor = "LOCAL RADIUS (< 2 KM)";
    advisory = "WATCH: Buddy system mandatory. Radio check-ins every 15 minutes for any exterior movement.";
  }

  return {
    id: "outdoor-operations",
    label: "Outdoor Operation Availability",
    status,
    color: IMPACT_COLORS[status],
    value: `${availabilityPercent}%`,
    metricValue: availabilityPercent,
    unit: "%",
    windowDuration,
    traverseCorridor,
    subtext: `${windowDuration} · ${traverseCorridor}`,
    advisory,
    factors,
  };
}

/**
 * Master Weather Impact Engine
 * Connects raw or normalized weather conditions to station operations,
 * synthesizing outputs for Power Demand, Communication Reliability,
 * Equipment Stress, and Outdoor Operation Availability.
 *
 * Integrates directly with the Risk Engine and Weather Event Engine.
 *
 * @param {object} weather - Weather data or object
 * @param {object} [options] - Integration options
 * @param {object} [options.riskAssessment] - Precomputed station risk assessment
 * @param {Array} [options.weatherEvents] - Precomputed active weather events
 * @returns {object} Comprehensive station weather impacts
 */
export function evaluateWeatherImpacts(weather, options = {}) {
  // Extract inputs
  const temp = Number(weather?.temperature ?? -20);
  const apparentTemp = Number(weather?.apparentTemperature ?? temp);
  const wind = Number(weather?.windSpeedKmH ?? weather?.windSpeed ?? 0);
  const humidity = Number(weather?.relativeHumidity ?? weather?.humidity ?? 50);
  const pressure = Number(weather?.surfacePressureHPa ?? weather?.pressure ?? 990);

  const params = { temp, wind, humidity, pressure, apparentTemp };

  // Calculate the 4 core impact vectors
  const powerDemand = evaluatePowerDemand(params);
  const commsReliability = evaluateCommunicationReliability(params);
  const equipmentStress = evaluateEquipmentStress(params);
  const outdoorAvailability = evaluateOutdoorOperationAvailability(params);

  // Integrate with existing Risk Engine
  const riskAssessment = options.riskAssessment || assessStationRisk(weather);

  // Integrate with existing Weather Event Engine
  const activeEvents = options.weatherEvents || detectWeatherEvents(weather);

  // Cross-correlate: If Risk Engine reports CRITICAL personnel or equipment risk,
  // ensure Outdoor Availability and Equipment Stress reflect at least WARNING or CRITICAL
  if (riskAssessment.personnel.level === RISK_LEVELS.CRITICAL && outdoorAvailability.status !== IMPACT_STATUS.CRITICAL) {
    outdoorAvailability.status = IMPACT_STATUS.CRITICAL;
    outdoorAvailability.color = IMPACT_COLORS.CRITICAL;
    outdoorAvailability.subtext = "OVERRIDE: Personnel Risk Engine Critical";
  }

  if (riskAssessment.equipment.level === RISK_LEVELS.CRITICAL && equipmentStress.status !== IMPACT_STATUS.CRITICAL) {
    equipmentStress.status = IMPACT_STATUS.CRITICAL;
    equipmentStress.color = IMPACT_COLORS.CRITICAL;
    equipmentStress.subtext = "OVERRIDE: Equipment Risk Engine Critical";
  }

  // Check if any Severe Weather Alert or High Wind Event is active at CRITICAL severity
  const hasCriticalEvent = activeEvents.some((e) => e.severity === "CRITICAL");
  const hasWarningEvent = activeEvents.some((e) => e.severity === "WARNING");

  // Determine Overall Mission Impact Status (highest of the 4 vectors + events)
  const vectorStatuses = [
    powerDemand.status,
    commsReliability.status,
    equipmentStress.status,
    outdoorAvailability.status,
  ];

  let highestRank = Math.max(...vectorStatuses.map((s) => SEVERITY_RANK[s] || 1));

  if (hasCriticalEvent && highestRank < SEVERITY_RANK[IMPACT_STATUS.CRITICAL]) {
    highestRank = SEVERITY_RANK[IMPACT_STATUS.CRITICAL];
  } else if (hasWarningEvent && highestRank < SEVERITY_RANK[IMPACT_STATUS.WARNING]) {
    highestRank = Math.max(highestRank, SEVERITY_RANK[IMPACT_STATUS.WARNING]);
  }

  const overallStatus = Object.keys(SEVERITY_RANK).find(
    (key) => SEVERITY_RANK[key] === highestRank
  ) || IMPACT_STATUS.NORMAL;

  return {
    powerDemand,
    communicationReliability: commsReliability,
    equipmentStress,
    outdoorOperationAvailability: outdoorAvailability,
    overallStatus,
    color: IMPACT_COLORS[overallStatus],
    riskAssessment,
    activeEvents,
    activeEventsCount: activeEvents.length,
    inputs: {
      temperature: temp,
      apparentTemperature: apparentTemp,
      windSpeedKmH: wind,
      relativeHumidity: humidity,
      surfacePressureHPa: pressure,
    },
    stationId: weather?.stationId || "BHARATI",
    stationName: weather?.stationName || "Bharati Station",
    timestamp: weather?.fetchedAt || new Date().toISOString(),
  };
}

export default {
  IMPACT_STATUS,
  IMPACT_COLORS,
  evaluatePowerDemand,
  evaluateCommunicationReliability,
  evaluateEquipmentStress,
  evaluateOutdoorOperationAvailability,
  evaluateWeatherImpacts,
};
