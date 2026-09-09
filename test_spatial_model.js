// test_spatial_model.js — Test Suite for Tactical Station Spatial Model Architecture

import assert from "node:assert";

console.log("=== RUNNING TACTICAL STATION SPATIAL MODEL VALIDATION ===");

// 1. Definition of the 6 Required Station Zones
export const STATION_ZONES = [
  {
    id: "habitat",
    code: "Z-01",
    name: "MAIN HABITAT",
    type: "HABITAT",
    elevation: "+35m MSL",
    distance: "0 m (Ref)",
    description: "Two-deck aerodynamic core module on 3.5m hydraulic stilts. Contains primary command ops, living quarters, galley, and HVAC life support.",
    specs: { crew: 24, baseLoadKW: 34, targetTempC: 21 },
    connections: { powerFrom: "generator", fuelFrom: null, commsWith: ["comm-tower", "lab", "generator", "storage"] },
  },
  {
    id: "generator",
    code: "Z-02",
    name: "GENERATOR BAY",
    type: "POWER",
    elevation: "+33m MSL",
    distance: "28 m WNW",
    description: "Reinforced thermal industrial shelter housing 3 Caterpillar diesel generator sets, radiator louvers, silencers, and high-voltage switchgear.",
    specs: { units: 3, capacityKW: 180, fuelFeed: "P-01 Pipeline" },
    connections: { powerTo: ["habitat", "lab", "comm-tower", "fuel", "storage"], fuelFrom: "fuel", commsWith: ["habitat"] },
  },
  {
    id: "fuel",
    code: "Z-03",
    name: "FUEL RESERVE",
    type: "LOGISTICS",
    elevation: "+31m MSL",
    distance: "42 m WSW",
    description: "4 double-walled cryogenic cylindrical bulk diesel tanks inside an insulated spill-containment bund with trace-heated manifold lines.",
    specs: { tanks: 4, totalCapacityL: 120000, traceHeating: true },
    connections: { powerFrom: "generator", fuelTo: "generator", commsWith: ["habitat"] },
  },
  {
    id: "lab",
    code: "Z-04",
    name: "LABORATORY",
    type: "RESEARCH",
    elevation: "+36m MSL",
    distance: "32 m ENE",
    description: "Clean modular science pods for earth sciences, atmospheric chemistry, ionospheric monitoring, and optical spectrometry.",
    specs: { pods: 3, cleanroomClass: "ISO 7", instrumentLoadKW: 14 },
    connections: { powerFrom: "generator", fuelFrom: null, commsWith: ["habitat", "comm-tower"] },
  },
  {
    id: "comm-tower",
    code: "Z-05",
    name: "COMMUNICATION TOWER",
    type: "TELECOM",
    elevation: "+47m MSL (High Knoll)",
    distance: "38 m NNE",
    description: "Elevated structural lattice steel mast supporting 4.5m tracked satellite radome, HF long-wire arrays, and microwave telemetry dishes.",
    specs: { heightM: 18, dishes: 2, radomeDeIceKW: 8 },
    connections: { powerFrom: "generator", fuelFrom: null, commsWith: ["habitat", "lab"] },
  },
  {
    id: "storage",
    code: "Z-06",
    name: "STORAGE AREA & VEHICLE BAY",
    type: "LOGISTICS",
    elevation: "+32m MSL",
    distance: "46 m SSE",
    description: "Arched insulated maintenance hangar with ramp for PistenBully snowcats, cold-soak spare components, and 180-day emergency survival rations.",
    specs: { vehicles: 2, hangarTempC: 8, emergencyRationsDays: 180 },
    connections: { powerFrom: "generator", fuelFrom: null, commsWith: ["habitat"] },
  },
];

// Verify 6 zones exist
assert.strictEqual(STATION_ZONES.length, 6, "Must define exactly 6 station zones");
const zoneIds = STATION_ZONES.map(z => z.id);
assert.ok(zoneIds.includes("habitat"), "Main Habitat must exist");
assert.ok(zoneIds.includes("generator"), "Generator Bay must exist");
assert.ok(zoneIds.includes("fuel"), "Fuel Reserve must exist");
assert.ok(zoneIds.includes("lab"), "Laboratory must exist");
assert.ok(zoneIds.includes("comm-tower"), "Communication Tower must exist");
assert.ok(zoneIds.includes("storage"), "Storage Area must exist");
console.log("✅ All 6 realistic station zones defined with specifications and elevations");

// 2. Definition of 3 Connection Path Networks
export const CONDUIT_SYSTEMS = {
  POWER: [
    { from: "generator", to: "habitat", type: "POWER", label: "Main 415V Bus (HVAC & Living)", priority: "CRITICAL" },
    { from: "generator", to: "lab", type: "POWER", label: "Regulated Instrument Feeder", priority: "HIGH" },
    { from: "generator", to: "comm-tower", type: "POWER", label: "UPS Telemetry Feeder & Radome Heaters", priority: "CRITICAL" },
    { from: "generator", to: "fuel", type: "POWER", label: "Trace Heating & Pump Power", priority: "HIGH" },
    { from: "generator", to: "storage", type: "POWER", label: "Hangar Heating & Charger Circuit", priority: "MEDIUM" },
  ],
  FUEL: [
    { from: "fuel", to: "generator", type: "FUEL", label: "Trace-Heated Dual Diesel Supply Line", priority: "CRITICAL" },
  ],
  COMMS: [
    { from: "comm-tower", to: "habitat", type: "COMMS", label: "Primary SatSync & Broadband Trunk", priority: "CRITICAL" },
    { from: "habitat", to: "lab", type: "COMMS", label: "High-Speed Sensor Data Ring", priority: "HIGH" },
    { from: "habitat", to: "generator", type: "COMMS", label: "SCADA Power Plant Control Loop", priority: "HIGH" },
    { from: "habitat", to: "storage", type: "COMMS", label: "Depot Security & Environmental Bus", priority: "MEDIUM" },
  ],
};

assert.ok(CONDUIT_SYSTEMS.POWER.length >= 5, "Power grid must connect to all station sectors");
assert.ok(CONDUIT_SYSTEMS.FUEL.length >= 1, "Fuel pipeline must connect fuel reserve to generator bay");
assert.ok(CONDUIT_SYSTEMS.COMMS.length >= 4, "Comms data bus must form a robust station network");
console.log("✅ All 3 conduit systems (Power, Fuel, Communications) verified");

// 3. Weather-Influenced Visual State Function
export function getSpatialWeatherVisualState(weather) {
  if (!weather) return { state: "NORMAL", tone: "normal", windVectorActive: false, blizzardDrift: false };

  const temp = Number(weather.temperature ?? -20);
  const wind = Number(weather.windSpeedKmH ?? 0);
  const pressure = Number(weather.surfacePressureHPa ?? 990);

  if (temp <= -40 || wind >= 50 || pressure <= 960) {
    return {
      state: "CRITICAL",
      tone: "critical",
      label: "BLIZZARD SEVERE HAZARD // ZERO VISIBILITY",
      windVectorActive: true,
      blizzardDrift: true,
      windBearing: weather.windDirectionCompass || "S",
      windDeg: weather.windDirectionDeg || 180,
      outdoorMovement: "LOCKDOWN (0 MIN)",
    };
  }

  if (temp <= -30 || wind >= 35 || pressure <= 975) {
    return {
      state: "WARNING",
      tone: "warning",
      label: "KATABATIC WIND ADVISORY // TETHER REQUIRED",
      windVectorActive: true,
      blizzardDrift: false,
      windBearing: weather.windDirectionCompass || "S",
      windDeg: weather.windDirectionDeg || 180,
      outdoorMovement: "RESTRICTED SORTIE (MAX 15 MIN)",
    };
  }

  return {
    state: "NORMAL",
    tone: "normal",
    label: "STATION EXTERIOR NOMINAL // ROUTINE OPS",
    windVectorActive: false,
    blizzardDrift: false,
    windBearing: weather.windDirectionCompass || "S",
    windDeg: weather.windDirectionDeg || 180,
    outdoorMovement: "OPEN ALL SECTORS",
  };
}

// Test weather states
const normalWx = getSpatialWeatherVisualState({ temperature: -18, windSpeedKmH: 15, surfacePressureHPa: 992 });
assert.strictEqual(normalWx.state, "NORMAL");
assert.strictEqual(normalWx.outdoorMovement, "OPEN ALL SECTORS");
console.log("✅ Normal weather visual state evaluated correctly");

const warnWx = getSpatialWeatherVisualState({ temperature: -34, windSpeedKmH: 38, surfacePressureHPa: 974 });
assert.strictEqual(warnWx.state, "WARNING");
assert.strictEqual(warnWx.windVectorActive, true);
console.log("✅ Warning weather visual state with wind vector evaluated correctly");

const critWx = getSpatialWeatherVisualState({ temperature: -45, windSpeedKmH: 62, surfacePressureHPa: 955 });
assert.strictEqual(critWx.state, "CRITICAL");
assert.strictEqual(critWx.blizzardDrift, true);
assert.strictEqual(critWx.outdoorMovement, "LOCKDOWN (0 MIN)");
console.log("✅ Critical blizzard weather visual state evaluated correctly");

// 4. Zone Status Evaluation from Engine & Weather Telemetry
export function evaluateZoneTelemetry(zoneId, engine, weather) {
  const isGenCrit = engine?.generatorStatus === "CRITICAL";
  const isViscRisk = Boolean(engine?.viscosityRisk);
  const isColdRisk = (engine?.ambientTemp ?? -20) < -35;
  const isFuelLow = (engine?.survivalDays ?? 90) < 15;
  const windHigh = (weather?.windSpeedKmH ?? 0) >= 50;

  switch (zoneId) {
    case "generator": {
      const state = isGenCrit ? "CRITICAL" : (engine?.powerLoadKW ?? 50) > 90 ? "WARNING" : "NORMAL";
      return {
        state,
        status: state,
        metric: `${engine?.powerLoadKW?.toFixed(0) ?? 55} kW`,
        subtext: `${engine?.activeGenerators ?? 2}/3 Active Gens`,
        health: isGenCrit ? "45% (Fault on Gen 1)" : "98% Optimal",
        risk: isGenCrit ? "CRITICAL" : "LOW",
        loadPercent: Math.min(100, Math.round(((engine?.powerLoadKW ?? 55) / 120) * 100)),
      };
    }
    case "fuel": {
      const state = isFuelLow ? "CRITICAL" : (isViscRisk || isColdRisk) ? "WARNING" : "NORMAL";
      const fuelPercent = engine ? Math.round((engine.currentFuel / engine.fuelTankCapacity) * 100) : 78;
      return {
        state,
        status: state,
        metric: `${fuelPercent}% Reserve`,
        subtext: `${engine?.survivalDays?.toFixed(1) ?? 82} Days Survival`,
        health: isViscRisk ? "Trace Heating Active" : "Thermal Enclosure Nominal",
        risk: isFuelLow ? "CRITICAL" : isViscRisk ? "HIGH" : "LOW",
        loadPercent: fuelPercent,
      };
    }
    case "habitat": {
      const state = isGenCrit ? "WARNING" : "NORMAL";
      return {
        state,
        status: state,
        metric: "+21°C Target",
        subtext: "24 Crew Nominal",
        health: "Life Support 100%",
        risk: isGenCrit ? "HIGH" : "LOW",
        loadPercent: 70,
      };
    }
    case "lab": {
      const state = isGenCrit ? "WARNING" : "NORMAL";
      return {
        state,
        status: state,
        metric: "14.2 kW",
        subtext: "ISO 7 Cleanroom",
        health: "Sensor Uptime 99.8%",
        risk: isGenCrit ? "MEDIUM" : "LOW",
        loadPercent: 45,
      };
    }
    case "comm-tower": {
      const state = windHigh ? "WARNING" : "NORMAL";
      return {
        state,
        status: state,
        metric: engine?.isSatSyncMode ? "SATSYNC DELTA" : "HIGH-RES BROADBAND",
        subtext: "4.5m Geodesic Radome",
        health: windHigh ? "Buffeting Deflection ±4mm" : "Link Margin +18 dB",
        risk: windHigh ? "HIGH" : "LOW",
        loadPercent: 62,
      };
    }
    case "storage": {
      const state = isColdRisk ? "WARNING" : "NORMAL";
      return {
        state,
        status: state,
        metric: "2 PistenBully Ready",
        subtext: "180 Days Rations",
        health: "Hangar Seals Intact",
        risk: isColdRisk ? "MEDIUM" : "LOW",
        loadPercent: 35,
      };
    }
    default:
      return { state: "NORMAL", status: "NORMAL", metric: "--", subtext: "", health: "100%", risk: "LOW", loadPercent: 50 };
  }
}

// Test Zone Telemetry Evaluation
const genTel = evaluateZoneTelemetry("generator", { generatorStatus: "CRITICAL", powerLoadKW: 85, activeGenerators: 1 }, null);
assert.strictEqual(genTel.state, "CRITICAL");
assert.strictEqual(genTel.risk, "CRITICAL");
console.log("✅ Generator zone correctly flags CRITICAL under simulated engine fault");

const commTel = evaluateZoneTelemetry("comm-tower", { isSatSyncMode: true }, { windSpeedKmH: 55 });
assert.strictEqual(commTel.state, "WARNING");
assert.strictEqual(commTel.metric, "SATSYNC DELTA");
console.log("✅ Comm Tower zone telemetry evaluates wind buffeting and SatSync mode");

console.log("\n🎯 ALL TACTICAL STATION SPATIAL MODEL UNIT TESTS PASSED FLAWLESSLY!");
