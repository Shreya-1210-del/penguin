// DigitalTwin3D.jsx — Tactical Station Spatial Model & Digital Twin
// Top-down tactical station operations map representing true physical Antarctic station layout.
// Replaces floating overlapping panels with grounded architectural footprints, 6 real zones,
// 3 traceable conduit networks (Power, Fuel, Comms), live telemetry integration,
// and weather-driven visual states (Normal, Warning, Critical).

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Compass,
  Cpu,
  Crosshair,
  Flame,
  Layers3,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Rotate3D,
  Shield,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import VolumetricTwin3D from "./VolumetricTwin3D.jsx";

// ── 6 Real Station Zones Specification ──
const ZONES_DEF = [
  {
    id: "habitat",
    code: "Z-01",
    name: "MAIN HABITAT",
    subtitle: "Command & Living Quarters",
    category: "HABITAT",
    x: 410,
    y: 220,
    w: 190,
    h: 130,
    elevation: "+35m MSL",
    distance: "0 m (Ref)",
    color: "#2ed6a1", // emerald
    accent: "green",
    description: "Two-deck aerodynamic core module on 3.5m hydraulic stilts. Houses command bridge, expedition living quarters, central galley, medical bay, and environmental life-support HVAC.",
    subsystems: [
      { name: "Environmental HVAC", status: "ONLINE", load: "22.4 kW", note: "+21°C Target" },
      { name: "Atmospheric Scrubbers", status: "NOMINAL", load: "4.8 kW", note: "O2 20.9% / CO2 0.04%" },
      { name: "Expedition Quarters", status: "ACTIVE", load: "6.8 kW", note: "24 Crew Occupancy" },
      { name: "Command Avionics", status: "ONLINE", load: "3.2 kW", note: "SCADA & Telemetry Core" },
    ],
  },
  {
    id: "generator",
    code: "Z-02",
    name: "GENERATOR BAY",
    subtitle: "Primary Power Plant",
    category: "POWER",
    x: 130,
    y: 170,
    w: 160,
    h: 120,
    elevation: "+33m MSL",
    distance: "28 m WNW",
    color: "#52bfff", // cyan
    accent: "cyan",
    description: "Reinforced thermal industrial plant with sound-dampened enclosures, cooling intake louvers, and 3 Caterpillar diesel generator sets. Feeds high-voltage power to all station sectors.",
    subsystems: [
      { name: "Caterpillar Diesel Gen 1", status: "ACTIVE", load: "48 kW", note: "Primary Base Load" },
      { name: "Caterpillar Diesel Gen 2", status: "ACTIVE", load: "42 kW", note: "Secondary Load-Share" },
      { name: "Caterpillar Diesel Gen 3", status: "STANDBY", load: "0 kW", note: "Auto-Start Ready" },
      { name: "415V Switchgear & UPS", status: "NOMINAL", load: "98.2%", note: "Grid Frequency 50.0 Hz" },
    ],
  },
  {
    id: "fuel",
    code: "Z-03",
    name: "FUEL RESERVE",
    subtitle: "Cryogenic Diesel Storage",
    category: "LOGISTICS",
    x: 110,
    y: 390,
    w: 180,
    h: 140,
    elevation: "+31m MSL",
    distance: "42 m WSW",
    color: "#f4b64b", // amber
    accent: "amber",
    description: "4 double-walled insulated bulk diesel storage tanks housed in an engineered spill-containment bund. Equipped with auxiliary trace-heating lines to prevent viscosity wax precipitation.",
    subsystems: [
      { name: "Bulk Fuel Tank #1 & #2", status: "NOMINAL", load: "58,000 L", note: "Primary Manifold" },
      { name: "Bulk Fuel Tank #3 & #4", status: "NOMINAL", load: "54,200 L", note: "Reserve Manifold" },
      { name: "Trace-Heating Coils", status: "ACTIVE", load: "6.2 kW", note: "Viscosity Protection" },
      { name: "Cryo Transfer Pumps", status: "STANDBY", load: "1.4 kW", note: "P-01 Pipeline Feed" },
    ],
  },
  {
    id: "lab",
    code: "Z-04",
    name: "LABORATORY",
    subtitle: "Earth & Atmospheric Sciences",
    category: "RESEARCH",
    x: 720,
    y: 160,
    w: 160,
    h: 120,
    elevation: "+36m MSL",
    distance: "32 m ENE",
    color: "#a78bfa", // purple
    accent: "purple",
    description: "Cleanroom modular research pods for ionospheric studies, atmospheric air sampling, geomagnetic field sensing, and optical spectrometry. Isolated from generator diesel soot plumes.",
    subsystems: [
      { name: "Atmospheric Spectrometer", status: "ONLINE", load: "5.4 kW", note: "Continuous Sampling" },
      { name: "Geomagnetic Fluxgate", status: "ONLINE", load: "2.1 kW", note: "Zero Drift Calibrated" },
      { name: "Cleanroom Air Handling", status: "ISO 7", load: "4.6 kW", note: "HEPA Filtered" },
      { name: "Data Acquisition Node", status: "ONLINE", load: "2.1 kW", note: "InfluxDB Logger" },
    ],
  },
  {
    id: "comm-tower",
    code: "Z-05",
    name: "COMMUNICATION TOWER",
    subtitle: "Satellite Ground Terminal",
    category: "TELECOM",
    x: 440,
    y: 50,
    w: 130,
    h: 100,
    elevation: "+47m MSL (High Knoll)",
    distance: "38 m NNE",
    color: "#38bdf8", // light blue
    accent: "sky",
    description: "Structural lattice steel tower situated on the highest local knoll. Houses a 4.5m tracked satellite radome for SatSync, C-band data uplinks, VHF local comms, and weather radar arrays.",
    subsystems: [
      { name: "4.5m Tracked Radome", status: "ONLINE", load: "4.2 kW", note: "SatSync Uplink Active" },
      { name: "Radome De-Ice Heating", status: "HEATING", load: "5.6 kW", note: "Rime Ice Mitigation" },
      { name: "HF Long-Wire Antenna", status: "STANDBY", load: "0.8 kW", note: "Polar Emergency Link" },
      { name: "VHF Ground-Air Radio", status: "NOMINAL", load: "0.6 kW", note: "Helicopter Sortie Ch" },
    ],
  },
  {
    id: "storage",
    code: "Z-06",
    name: "STORAGE AREA & DEPOT",
    subtitle: "Vehicle Bay & Cold Logistics",
    category: "LOGISTICS",
    x: 710,
    y: 380,
    w: 180,
    h: 130,
    elevation: "+32m MSL",
    distance: "46 m SSE",
    color: "#fb923c", // orange
    accent: "orange",
    description: "Heavy insulated arched hangar with exterior ramp for PistenBully snowcats, cold-soak spare generator components, emergency dry rations, and polar survival field gear.",
    subsystems: [
      { name: "PistenBully Snowcat Bay", status: "READY", load: "3.4 kW", note: "2 Tracked Units Operational" },
      { name: "Autonomous Supply Rover", status: "PATROLLING", load: "1.2 kW", note: "Lidar Transfer Loop Active" },
      { name: "All-Terrain Telehandler", status: "STANDBY", load: "0.4 kW", note: "Block Heater Nominal" },
      { name: "Emergency Dry Rations", status: "SECURE", load: "0 kW", note: "180 Days Food Reserve (312 Packs)" },
      { name: "Cold-Soak Spare Parts", status: "INDEXED", load: "1.2 kW", note: "27 Critical Spares (98% Inventory)" },
      { name: "Heavy Hangar Door Seals", status: "LOCKED", load: "1.8 kW", note: "Thermal Gasket Heated (-40°C Rating)" },
    ],
  },
];

// ── Physical Corridors (Enclosed Skywalks) ──
const CORRIDORS = [
  { id: "c-gen", name: "Corridor C-01", from: [290, 230], to: [410, 270], label: "SKYWALK C-01 (POWER PLANT)" },
  { id: "c-lab", name: "Corridor C-02", from: [600, 270], to: [720, 220], label: "SKYWALK C-02 (LAB ACCESS)" },
  { id: "c-sto", name: "Corridor C-03", from: [580, 340], to: [710, 420], label: "SKYWALK C-03 (DEPOT ACCESS)" },
];

// ── 3 Conduit Networks (Power, Fuel, Comms) ──
const CONDUITS = [
  // 1. Power Grid Lines (Originate at Generator Bay)
  { id: "p-hab", type: "POWER", points: [[290, 210], [350, 210], [410, 250]], label: "MAIN 415V BUS (HABITAT)", color: "#f59e0b" },
  { id: "p-lab", type: "POWER", points: [[290, 200], [350, 200], [660, 150], [720, 190]], label: "REGULATED FEED (LAB)", color: "#f59e0b" },
  { id: "p-com", type: "POWER", points: [[210, 170], [210, 100], [440, 100]], label: "UPS TELEMETRY FEED (COMMS)", color: "#f59e0b" },
  { id: "p-fuel", type: "POWER", points: [[210, 290], [210, 390]], label: "TRACE HEATING RUN (FUEL)", color: "#f59e0b" },
  { id: "p-sto", type: "POWER", points: [[290, 280], [380, 380], [640, 470], [710, 470]], label: "HANGAR AUXILIARY (STORAGE)", color: "#f59e0b" },

  // 2. Fuel Pipeline Network (Fuel Reserve to Generator Bay)
  { id: "f-gen", type: "FUEL", points: [[230, 390], [230, 290]], label: "TRACE-HEATED DIESEL FEED (P-01)", color: "#ef4444" },
  { id: "f-ret", type: "FUEL", points: [[250, 290], [250, 390]], label: "DIESEL RETURN LINE (P-02)", color: "#b91c1c" },

  // 3. Communications & SCADA Data Bus (Originates at Comm Tower)
  { id: "d-hab", type: "COMMS", points: [[505, 150], [505, 220]], label: "SATSYNC & BROADBAND FIBER", color: "#38bdf8" },
  { id: "d-lab", type: "COMMS", points: [[570, 110], [750, 110], [750, 160]], label: "SCIENCE SENSOR RING", color: "#38bdf8" },
  { id: "d-gen", type: "COMMS", points: [[440, 120], [260, 120], [260, 170]], label: "SCADA POWER PLANT LOOP", color: "#38bdf8" },
  { id: "d-sto", type: "COMMS", points: [[560, 350], [660, 400], [710, 400]], label: "DEPOT TELEMETRY BUS", color: "#38bdf8" },
];

export default function DigitalTwin3D({ engine, weather, stationInfo }) {
  const [viewMode, setViewMode] = useState("2d"); // "2d" = Tactical Blueprint (default), "3d" = Volumetric Digital Twin
  const [view, setView] = useState("top"); // "top" = 2D Tactical Blueprint, "iso" = 3D Isometric View
  const [activeLayer, setActiveLayer] = useState("ALL"); // "ALL", "POWER", "FUEL", "COMMS"
  const [hoveredZone, setHoveredZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // ── Compute Live Weather Impact on Spatial Environment ──
  const weatherState = useMemo(() => {
    if (!weather) return { state: "NORMAL", tone: "normal", label: "STATION EXTERIOR NOMINAL", drift: false, windDeg: 180, windSpeed: 10 };
    const temp = Number(weather.temperature ?? -20);
    const wind = Number(weather.windSpeedKmH ?? 0);
    const pressure = Number(weather.surfacePressureHPa ?? 990);

    if (temp <= -40 || wind >= 50 || pressure <= 960) {
      return {
        state: "CRITICAL",
        tone: "critical",
        label: "BLIZZARD EMERGENCY // ZERO-VISIBILITY WHITE-OUT // LOCKDOWN",
        drift: true,
        windDeg: weather.windDirectionDeg || 195,
        windSpeed: wind,
        outdoorAllowed: false,
      };
    }
    if (temp <= -30 || wind >= 35 || pressure <= 975) {
      return {
        state: "WARNING",
        tone: "warning",
        label: "KATABATIC WIND ADVISORY // TETHER REQUIRED // ELEVATED CHILL",
        drift: true,
        windDeg: weather.windDirectionDeg || 195,
        windSpeed: wind,
        outdoorAllowed: true,
      };
    }
    return {
      state: "NORMAL",
      tone: "normal",
      label: "STATION EXTERIOR NOMINAL // ROUTINE SORTIES OPEN",
      drift: false,
      windDeg: weather.windDirectionDeg || 180,
      windSpeed: wind,
      outdoorAllowed: true,
    };
  }, [weather]);

  // ── Live Telemetry Evaluator for each Zone ──
  const zoneStatus = useMemo(() => {
    const isGenCrit = engine?.generatorStatus === "CRITICAL";
    const isViscRisk = Boolean(engine?.viscosityRisk);
    const isColdRisk = (engine?.ambientTemp ?? -20) < -35;
    const isFuelLow = (engine?.survivalDays ?? 90) < 15;
    const windHigh = (weather?.windSpeedKmH ?? 0) >= 50;

    return {
      habitat: {
        state: isGenCrit ? "WARNING" : "NORMAL",
        tone: isGenCrit ? "warning" : "ok",
        metric: "+21.0°C",
        label: "HVAC NORMAL",
        health: "Life Support 100%",
        loadKW: 34.2,
        risk: isGenCrit ? "HIGH" : "LOW",
        badge: isGenCrit ? "BACKUP POWER" : "NOMINAL",
      },
      generator: {
        state: isGenCrit ? "CRITICAL" : (engine?.powerLoadKW ?? 50) > 90 ? "WARNING" : "NORMAL",
        tone: isGenCrit ? "critical" : (engine?.powerLoadKW ?? 50) > 90 ? "warning" : "ok",
        metric: `${(engine?.powerLoadKW ?? 52).toFixed(0)} kW`,
        label: `${engine?.activeGenerators ?? 2}/3 GENS`,
        health: isGenCrit ? "FAULT ON GEN 1" : "Vibration 0.8 mm/s",
        loadKW: engine?.powerLoadKW ?? 52,
        risk: isGenCrit ? "CRITICAL" : "LOW",
        badge: isGenCrit ? "GEN FAULT" : "OPTIMAL",
      },
      fuel: {
        state: isFuelLow ? "CRITICAL" : (isViscRisk || isColdRisk) ? "WARNING" : "NORMAL",
        tone: isFuelLow ? "critical" : (isViscRisk || isColdRisk) ? "warning" : "ok",
        metric: `${Math.round(((engine?.currentFuel ?? 88000) / (engine?.fuelTankCapacity ?? 120000)) * 100)}%`,
        label: `${(engine?.survivalDays ?? 76).toFixed(1)}d SURV`,
        health: isViscRisk ? "Trace Heating Active" : "Manifold Normal",
        loadKW: isViscRisk ? 6.4 : 1.2,
        risk: isFuelLow ? "CRITICAL" : isViscRisk ? "HIGH" : "LOW",
        badge: isViscRisk ? "TRACE HEAT" : "STABLE",
      },
      lab: {
        state: isGenCrit ? "WARNING" : "NORMAL",
        tone: isGenCrit ? "warning" : "ok",
        metric: "14.2 kW",
        label: "ISO-7 CLEAN",
        health: "Sensor Uptime 99.8%",
        loadKW: 14.2,
        risk: isGenCrit ? "MEDIUM" : "LOW",
        badge: "ONLINE",
      },
      "comm-tower": {
        state: windHigh ? "WARNING" : "NORMAL",
        tone: windHigh ? "warning" : "ok",
        metric: engine?.isSatSyncMode ? "SATSYNC" : "100 Mbps",
        label: windHigh ? "DEFLECT 4mm" : "MARGIN +18dB",
        health: windHigh ? "High Wind Buffeting" : "Radome De-Ice Active",
        loadKW: 9.8,
        risk: windHigh ? "HIGH" : "LOW",
        badge: engine?.isSatSyncMode ? "SATSYNC" : "BROADBAND",
      },
      storage: {
        state: isColdRisk ? "WARNING" : "NORMAL",
        tone: isColdRisk ? "warning" : "ok",
        metric: "2 PISTEN",
        label: "180d RATIONS",
        health: "Hangar Seals Intact",
        loadKW: 4.8,
        risk: isColdRisk ? "MEDIUM" : "LOW",
        badge: "READY",
      },
    };
  }, [engine, weather]);

  // ── Pan & Drag Handlers ──
  const handlePointerDown = (e) => {
    if (e.button !== 0) return; // primary click only
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handlePointerUp = (e) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.max(0.65, Math.min(1.75, +(z + delta).toFixed(2))));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filtered conduits based on active layer
  const visibleConduits = useMemo(() => {
    if (activeLayer === "ALL") return CONDUITS;
    return CONDUITS.filter((c) => c.type === activeLayer);
  }, [activeLayer]);

  // Transform styles for top-down vs isometric
  const stageTransform = useMemo(() => {
    const panStr = `translate(${pan.x}px, ${pan.y}px)`;
    if (view === "iso") {
      return `${panStr} scale(${zoom}) rotateX(55deg) rotateZ(-24deg)`;
    }
    return `${panStr} scale(${zoom})`;
  }, [pan, zoom, view]);

  return (
    <section className={`panel twin3d-panel tactical-spatial-model weather-${weatherState.tone}`} id="digital-twin">
      {/* ── Topbar Command Header ── */}
      <div className="panel-head">
        <div>
          <span className="eyebrow">FACILITY DIGITAL TWIN // TACTICAL BLUEPRINT</span>
          <h2>Station Spatial Model</h2>
        </div>

        {/* Action Controls & Layer Selector */}
        <div className="spatial-actions-row">
          {/* Conduit Layer Filter Buttons (Active in 2D Mode) */}
          {viewMode === "2d" && (
            <div className="spatial-layer-filters">
              <span className="spatial-filter-label">CONDUITS:</span>
              {["ALL", "POWER", "FUEL", "COMMS"].map((layer) => (
                <button
                  key={layer}
                  className={`spatial-layer-btn ${activeLayer === layer ? "active" : ""} layer-${layer.toLowerCase()}`}
                  onClick={() => setActiveLayer(layer)}
                  title={`Toggle ${layer} infrastructure path`}
                >
                  {layer === "POWER" && <Zap size={10} />}
                  {layer === "FUEL" && <Flame size={10} />}
                  {layer === "COMMS" && <Radio size={10} />}
                  {layer === "ALL" && <Layers3 size={10} />}
                  <span>{layer}</span>
                </button>
              ))}
            </div>
          )}

          {/* View Mode Toggle: 2D Tactical Blueprint vs 3D Volumetric Digital Twin */}
          <div className="twin-toolbar">
            <button
              className={viewMode === "2d" ? "active" : ""}
              onClick={() => setViewMode("2d")}
              title="Top-Down Tactical Blueprint View (Default Operational View)"
            >
              <Layers3 size={13} /> 2D TACTICAL
            </button>
            <button
              className={viewMode === "3d" ? "active" : ""}
              onClick={() => setViewMode("3d")}
              title="Volumetric 3D Station Digital Twin (Three.js WebGL)"
            >
              <Rotate3D size={13} /> 3D VOLUMETRIC
            </button>
          </div>
        </div>
      </div>

      {/* ── Tactical Weather Status Banner ── */}
      <div className={`spatial-weather-bar tone-${weatherState.tone}`}>
        <div className="spatial-weather-left">
          <i className="spatial-pulse-beacon" />
          <span className="spatial-weather-kicker">WEATHER OPERATIONAL ENVELOPE:</span>
          <b>{weatherState.label}</b>
        </div>
        <div className="spatial-weather-right">
          <span><Thermometer size={11} /> {engine?.ambientTemp?.toFixed(1) ?? "-20.0"}°C</span>
          <span><Wind size={11} /> {weather?.windSpeedKmH?.toFixed(1) ?? "12"} km/h {weather?.windDirectionCompass ?? "S"}</span>
          <span><Compass size={11} /> {stationInfo?.name ?? "BHARATI STATION"}</span>
        </div>
      </div>

      {/* ── Viewport Stage (2D Blueprint or 3D Volumetric Digital Twin) ── */}
      <div className="spatial-view-container">
        {viewMode === "2d" ? (
          /* ── Existing 2D Tactical Blueprint View (Default Operational View) ── */
          <div
            className="spatial-canvas-wrap fade-enter"
            ref={containerRef}
            onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Dynamic Blizzard Wind Particle Drift Overlay */}
        {weatherState.drift && (
          <div
            className="spatial-blizzard-overlay"
            style={{
              "--wind-angle": `${weatherState.windDeg}deg`,
              "--wind-speed": `${Math.max(0.4, 20 / weatherState.windSpeed)}s`,
            }}
          >
            <div className="blizzard-particle-stream stream-1" />
            <div className="blizzard-particle-stream stream-2" />
            <div className="blizzard-particle-stream stream-3" />
          </div>
        )}

        <div
          className={`spatial-stage-viewport ${view === "iso" ? "iso-mode" : "top-mode"}`}
          style={{ transform: stageTransform }}
        >
          {/* SVG Tactical Blueprint */}
          <svg
            viewBox="0 0 1000 620"
            className="spatial-svg"
            aria-label="Antarctic Station Tactical Spatial Model Blueprint"
          >
            <defs>
              {/* Glow Filters */}
              <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Linear Gradients for Modules */}
              <linearGradient id="gridBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#040e18" />
                <stop offset="100%" stopColor="#020810" />
              </linearGradient>
              <linearGradient id="habGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#102d38" />
                <stop offset="100%" stopColor="#081822" />
              </linearGradient>
              <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e2a3c" />
                <stop offset="100%" stopColor="#071724" />
              </linearGradient>
              <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c2210" />
                <stop offset="100%" stopColor="#161108" />
              </linearGradient>
              <linearGradient id="labGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#231a3d" />
                <stop offset="100%" stopColor="#100b20" />
              </linearGradient>
              <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0b2c3d" />
                <stop offset="100%" stopColor="#061824" />
              </linearGradient>
              <linearGradient id="stoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#281e14" />
                <stop offset="100%" stopColor="#140e08" />
              </linearGradient>
            </defs>

            {/* 1. Tactical Grid & Background */}
            <rect width="1000" height="620" fill="url(#gridBg)" />

            {/* 10m Tactical Grid Lines */}
            <g className="spatial-grid-lines" opacity="0.25">
              {Array.from({ length: 26 }).map((_, i) => (
                <line key={`vx-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="620" stroke="#1d435e" strokeWidth="0.8" />
              ))}
              {Array.from({ length: 16 }).map((_, i) => (
                <line key={`hz-${i}`} x1="0" y1={i * 40} x2="1000" y2={i * 40} stroke="#1d435e" strokeWidth="0.8" />
              ))}
            </g>

            {/* Elevation Contour Lines (Larsemann Hills Rock Ridge) */}
            <g className="spatial-contours" opacity="0.18">
              <path d="M 50 180 Q 250 110 500 130 T 950 100" fill="none" stroke="#52bfff" strokeWidth="1.2" strokeDasharray="6 6" />
              <path d="M 50 330 Q 300 280 550 310 T 950 290" fill="none" stroke="#52bfff" strokeWidth="1.2" strokeDasharray="6 6" />
              <path d="M 50 510 Q 350 460 600 490 T 950 480" fill="none" stroke="#52bfff" strokeWidth="1.2" strokeDasharray="6 6" />
            </g>

            {/* 2. Physical Enclosed Skywalk Corridors (Ground-Anchored) */}
            <g className="spatial-corridors">
              {CORRIDORS.map((cor) => {
                const [x1, y1] = cor.from;
                const [x2, y2] = cor.to;
                return (
                  <g key={cor.id} className="spatial-corridor-run">
                    {/* Shadow */}
                    <line x1={x1} y1={y1 + 4} x2={x2} y2={y2 + 4} stroke="#000000" strokeWidth="16" opacity="0.6" strokeLinecap="round" />
                    {/* Outer Shell */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#18364b" strokeWidth="14" strokeLinecap="round" />
                    {/* Interior Pressurized Walkway */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b2230" strokeWidth="8" strokeLinecap="round" />
                    {/* Center Stilt Guideline */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52bfff" strokeWidth="1.5" strokeDasharray="3 6" opacity="0.7" />
                    {/* Stilt Footing Nodes */}
                    <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="4" fill="#1e4d6a" stroke="#52bfff" strokeWidth="1" />
                  </g>
                );
              })}
            </g>

            {/* 3. Traceable Conduit Paths (Power, Fuel, Comms) */}
            <g className="spatial-conduits">
              {visibleConduits.map((c) => {
                const pathStr = c.points.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
                const isPower = c.type === "POWER";
                const isFuel = c.type === "FUEL";
                const isComms = c.type === "COMMS";

                return (
                  <g key={c.id} className={`conduit-group conduit-${c.type.toLowerCase()}`}>
                    {/* Background Conduit Trench */}
                    <path d={pathStr} fill="none" stroke="#05121c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Outer Pipe Border */}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={c.color}
                      strokeWidth="2.5"
                      strokeOpacity="0.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Dynamic Animated Core Pulse */}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={c.color}
                      strokeWidth="2"
                      strokeDasharray={isPower ? "6 8" : isFuel ? "12 10" : "4 6"}
                      className={`conduit-pulse-line pulse-${c.type.toLowerCase()}`}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Conduit Nodes */}
                    {c.points.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={c.color} opacity="0.85" />
                    ))}
                  </g>
                );
              })}
            </g>

            {/* 4. Six Station Building Zones */}
            <g className="spatial-zones">
              {ZONES_DEF.map((zone) => {
                const tel = zoneStatus[zone.id] || { state: "NORMAL", tone: "ok", metric: "--", label: "", badge: "OK" };
                const isSelected = selectedZone?.id === zone.id;
                const isHovered = hoveredZone?.id === zone.id;
                const strokeCol = tel.state === "CRITICAL" ? "#ff5d69" : tel.state === "WARNING" ? "#f4b64b" : zone.color;
                const fillGrad = `url(#${zone.id.replace("-", "")}Grad)`;

                return (
                  <g
                    key={zone.id}
                    className={`spatial-zone-node zone-${zone.id} state-${tel.state.toLowerCase()} ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedZone(zone)}
                    onMouseEnter={() => setHoveredZone(zone)}
                    onMouseLeave={() => setHoveredZone(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Ground Footing Drop Shadow */}
                    <rect
                      x={zone.x + 6}
                      y={zone.y + 8}
                      width={zone.w}
                      height={zone.h}
                      rx="12"
                      fill="#000000"
                      opacity="0.55"
                    />

                    {/* Stilt Foundation Pads (4-6 Pylons Elevating Station Above Ice) */}
                    <rect x={zone.x - 4} y={zone.y - 4} width="8" height="8" rx="2" fill="#143448" stroke="#366b88" strokeWidth="1" />
                    <rect x={zone.x + zone.w - 4} y={zone.y - 4} width="8" height="8" rx="2" fill="#143448" stroke="#366b88" strokeWidth="1" />
                    <rect x={zone.x - 4} y={zone.y + zone.h - 4} width="8" height="8" rx="2" fill="#143448" stroke="#366b88" strokeWidth="1" />
                    <rect x={zone.x + zone.w - 4} y={zone.y + zone.h - 4} width="8" height="8" rx="2" fill="#143448" stroke="#366b88" strokeWidth="1" />

                    {/* Main Building Perimeter Structure */}
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.w}
                      height={zone.h}
                      rx="10"
                      fill={fillGrad}
                      stroke={strokeCol}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.2}
                      filter={tel.state === "CRITICAL" ? "url(#glow-red)" : isHovered ? "url(#glow-cyan)" : undefined}
                    />

                    {/* Architectural Detail by Zone Type */}
                    {zone.id === "habitat" && (
                      <g className="arch-detail">
                        {/* Aerodynamic Chamfered Edge Lines */}
                        <line x1={zone.x + 20} y1={zone.y + 12} x2={zone.x + zone.w - 20} y2={zone.y + 12} stroke="#32637a" strokeWidth="1" />
                        <line x1={zone.x + 20} y1={zone.y + zone.h - 12} x2={zone.x + zone.w - 20} y2={zone.y + zone.h - 12} stroke="#32637a" strokeWidth="1" />
                        {/* Center Observation Cupola */}
                        <circle cx={zone.x + zone.w / 2} cy={zone.y + zone.h / 2 - 6} r="18" fill="#0b2432" stroke="#2ed6a1" strokeWidth="1.2" opacity="0.8" />
                        <circle cx={zone.x + zone.w / 2} cy={zone.y + zone.h / 2 - 6} r="8" fill="#2ed6a1" opacity="0.4" />
                        {/* Solar Skin Roof Tiles */}
                        <rect x={zone.x + 25} y={zone.y + 22} width="40" height="20" rx="3" fill="#091b24" stroke="#204f64" strokeWidth="0.8" />
                        <rect x={zone.x + zone.w - 65} y={zone.y + 22} width="40" height="20" rx="3" fill="#091b24" stroke="#204f64" strokeWidth="0.8" />
                      </g>
                    )}

                    {zone.id === "generator" && (
                      <g className="arch-detail">
                        {/* 3 Generator Set Silhouettes */}
                        <rect x={zone.x + 16} y={zone.y + 28} width="34" height="42" rx="4" fill="#061722" stroke="#52bfff" strokeWidth="1" />
                        <rect x={zone.x + 62} y={zone.y + 28} width="34" height="42" rx="4" fill="#061722" stroke="#52bfff" strokeWidth="1" />
                        <rect x={zone.x + 108} y={zone.y + 28} width="34" height="42" rx="4" fill="#061722" stroke="#336680" strokeWidth="1" />
                        <text x={zone.x + 33} y={zone.y + 53} textAnchor="middle" fill="#8cb9ce" fontSize="8" fontFamily="var(--mono)">G1</text>
                        <text x={zone.x + 79} y={zone.y + 53} textAnchor="middle" fill="#8cb9ce" fontSize="8" fontFamily="var(--mono)">G2</text>
                        <text x={zone.x + 125} y={zone.y + 53} textAnchor="middle" fill="#507c91" fontSize="8" fontFamily="var(--mono)">G3</text>
                        {/* Exhaust Flues */}
                        <circle cx={zone.x + 33} cy={zone.y + 16} r="3" fill="#f59e0b" opacity="0.8" />
                        <circle cx={zone.x + 79} cy={zone.y + 16} r="3" fill="#f59e0b" opacity="0.8" />
                        <circle cx={zone.x + 125} cy={zone.y + 16} r="3" fill="#507c91" opacity="0.5" />
                        {/* Cooling Louvers */}
                        <line x1={zone.x + 20} y1={zone.y + 80} x2={zone.x + zone.w - 20} y2={zone.y + 80} stroke="#214d66" strokeWidth="2" strokeDasharray="3 3" />
                      </g>
                    )}

                    {zone.id === "fuel" && (
                      <g className="arch-detail">
                        {/* 4 Cylindrical Tank Silhouettes */}
                        <circle cx={zone.x + 48} cy={zone.y + 44} r="22" fill="#0d1b1f" stroke="#f4b64b" strokeWidth="1.2" />
                        <circle cx={zone.x + 132} cy={zone.y + 44} r="22" fill="#0d1b1f" stroke="#f4b64b" strokeWidth="1.2" />
                        <circle cx={zone.x + 48} cy={zone.y + 96} r="22" fill="#0d1b1f" stroke="#f4b64b" strokeWidth="1.2" />
                        <circle cx={zone.x + 132} cy={zone.y + 96} r="22" fill="#0d1b1f" stroke="#f4b64b" strokeWidth="1.2" />
                        {/* Center Tank Manifolds */}
                        <circle cx={zone.x + 48} cy={zone.y + 44} r="6" fill="#f4b64b" opacity="0.7" />
                        <circle cx={zone.x + 132} cy={zone.y + 44} r="6" fill="#f4b64b" opacity="0.7" />
                        <circle cx={zone.x + 48} cy={zone.y + 96} r="6" fill="#f4b64b" opacity="0.7" />
                        <circle cx={zone.x + 132} cy={zone.y + 96} r="6" fill="#f4b64b" opacity="0.7" />
                        {/* Interconnecting Trace Lines */}
                        <line x1={zone.x + 48} y1={zone.y + 66} x2={zone.x + 48} y2={zone.y + 74} stroke="#f4b64b" strokeWidth="2" />
                        <line x1={zone.x + 132} y1={zone.y + 66} x2={zone.x + 132} y2={zone.y + 74} stroke="#f4b64b" strokeWidth="2" />
                        <line x1={zone.x + 70} y1={zone.y + 70} x2={zone.x + 110} y2={zone.y + 70} stroke="#f4b64b" strokeWidth="2" />
                      </g>
                    )}

                    {zone.id === "lab" && (
                      <g className="arch-detail">
                        {/* Cleanroom Module Pods */}
                        <rect x={zone.x + 16} y={zone.y + 24} width="58" height="50" rx="4" fill="#0b172a" stroke="#a78bfa" strokeWidth="0.8" />
                        <rect x={zone.x + 86} y={zone.y + 24} width="58" height="50" rx="4" fill="#0b172a" stroke="#a78bfa" strokeWidth="0.8" />
                        {/* Optical Spectrometry Dome */}
                        <circle cx={zone.x + 45} cy={zone.y + 49} r="12" fill="#182344" stroke="#a78bfa" strokeWidth="1" />
                        <circle cx={zone.x + 45} cy={zone.y + 49} r="4" fill="#38bdf8" />
                        {/* Sensor Mast */}
                        <line x1={zone.x + 115} y1={zone.y + 35} x2={zone.x + 115} y2={zone.y + 63} stroke="#a78bfa" strokeWidth="1.5" />
                        <circle cx={zone.x + 115} cy={zone.y + 35} r="3" fill="#a78bfa" />
                      </g>
                    )}

                    {zone.id === "comm-tower" && (
                      <g className="arch-detail">
                        {/* Lattice Mast Base Triangle */}
                        <polygon
                          points={`${zone.x + zone.w / 2},${zone.y + 14} ${zone.x + 24},${zone.y + 74} ${zone.x + zone.w - 24},${zone.y + 74}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                        />
                        <line x1={zone.x + zone.w / 2} y1={zone.y + 14} x2={zone.x + zone.w / 2} y2={zone.y + 74} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
                        {/* Geodesic Radome Dish (Spherical Cap) */}
                        <circle cx={zone.x + zone.w / 2} cy={zone.y + 38} r="18" fill="#082232" stroke="#38bdf8" strokeWidth="1.5" />
                        <circle cx={zone.x + zone.w / 2} cy={zone.y + 38} r="6" fill="#38bdf8" opacity="0.6" />
                        {/* Pulse Beacons */}
                        <circle cx={zone.x + zone.w / 2} cy={zone.y + 14} r="2.5" fill="#38bdf8" className="beacon-dot" />
                      </g>
                    )}

                    {zone.id === "storage" && (
                      <g className="arch-detail">
                        {/* Arched Hangar Ribs */}
                        <path
                          d={`M ${zone.x + 20} ${zone.y + 70} Q ${zone.x + zone.w / 2} ${zone.y + 14} ${zone.x + zone.w - 20} ${zone.y + 70}`}
                          fill="none"
                          stroke="#fb923c"
                          strokeWidth="1.2"
                        />
                        {/* Snowcat Vehicle Bay Ramp */}
                        <rect x={zone.x + 36} y={zone.y + 32} width="46" height="42" rx="3" fill="#141c18" stroke="#fb923c" strokeWidth="0.8" />
                        <text x={zone.x + 59} y={zone.y + 56} textAnchor="middle" fill="#fb923c" fontSize="7.5" fontFamily="var(--mono)">P-CAT</text>
                        {/* Supply Racks */}
                        <line x1={zone.x + 100} y1={zone.y + 32} x2={zone.x + zone.w - 24} y2={zone.y + 32} stroke="#684a2b" strokeWidth="2" strokeDasharray="4 4" />
                        <line x1={zone.x + 100} y1={zone.y + 52} x2={zone.x + zone.w - 24} y2={zone.y + 52} stroke="#684a2b" strokeWidth="2" strokeDasharray="4 4" />
                      </g>
                    )}

                    {/* Zone Header Label & Callout */}
                    <rect x={zone.x + 10} y={zone.y + 10} width="32" height="14" rx="3" fill="#040c14" stroke={strokeCol} strokeWidth="0.8" />
                    <text x={zone.x + 26} y={zone.y + 20} textAnchor="middle" fill={strokeCol} fontSize="8" fontWeight="700" fontFamily="var(--mono)">
                      {zone.code}
                    </text>

                    {/* Zone Title Text */}
                    <text x={zone.x + 48} y={zone.y + 21} fill="#e5f1f8" fontSize="9.5" fontWeight="700" fontFamily="var(--mono)">
                      {zone.name}
                    </text>

                    {/* Live Metric Banner at Bottom of Module */}
                    <g className="zone-metric-strip">
                      <rect x={zone.x + 8} y={zone.y + zone.h - 22} width={zone.w - 16} height="16" rx="3" fill="#030c14" stroke="#1c3d52" strokeWidth="0.8" />
                      <circle cx={zone.x + 18} cy={zone.y + zone.h - 14} r="3" fill={tel.state === "CRITICAL" ? "#ff5d69" : tel.state === "WARNING" ? "#f4b64b" : "#2ed6a1"} />
                      <text x={zone.x + 26} y={zone.y + zone.h - 11} fill="#88afc4" fontSize="8" fontFamily="var(--mono)">
                        {tel.label}
                      </text>
                      <text x={zone.x + zone.w - 14} y={zone.y + zone.h - 11} textAnchor="end" fill="#e5f1f8" fontSize="8" fontWeight="700" fontFamily="var(--mono)">
                        {tel.metric}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* 5. Scale Bar & North Compass Rose */}
            <g className="spatial-hud-decorations">
              {/* Metric Scale Bar (0 — 25m — 50m) */}
              <g transform="translate(40, 570)">
                <rect x="0" y="0" width="140" height="28" rx="4" fill="#061420" stroke="#1d435e" strokeWidth="0.8" />
                <line x1="16" y1="12" x2="124" y2="12" stroke="#52bfff" strokeWidth="1.5" />
                <line x1="16" y1="7" x2="16" y2="17" stroke="#52bfff" strokeWidth="1.5" />
                <line x1="70" y1="9" x2="70" y2="15" stroke="#52bfff" strokeWidth="1" />
                <line x1="124" y1="7" x2="124" y2="17" stroke="#52bfff" strokeWidth="1.5" />
                <text x="16" y="24" fill="#6d93a8" fontSize="7" fontFamily="var(--mono)">0m</text>
                <text x="66" y="24" fill="#6d93a8" fontSize="7" fontFamily="var(--mono)">25m</text>
                <text x="114" y="24" fill="#6d93a8" fontSize="7" fontFamily="var(--mono)">50m</text>
              </g>

              {/* Tactical North Compass Rose with Live Wind Vector */}
              <g transform="translate(940, 60)">
                <circle cx="0" cy="0" r="28" fill="#061420" stroke="#1d435e" strokeWidth="1" opacity="0.9" />
                <circle cx="0" cy="0" r="23" fill="none" stroke="#255577" strokeWidth="0.6" strokeDasharray="2 3" />
                {/* North Pointer */}
                <polygon points="0,-22 4,-6 -4,-6" fill="#ff5d69" />
                <polygon points="0,22 4,6 -4,6" fill="#4d748c" />
                <text x="0" y="-24" textAnchor="middle" fill="#ff5d69" fontSize="8" fontWeight="700" fontFamily="var(--mono)">N</text>
                <text x="0" y="29" textAnchor="middle" fill="#688ca0" fontSize="7" fontFamily="var(--mono)">S</text>
                <text x="25" y="3" textAnchor="middle" fill="#688ca0" fontSize="7" fontFamily="var(--mono)">E</text>
                <text x="-25" y="3" textAnchor="middle" fill="#688ca0" fontSize="7" fontFamily="var(--mono)">W</text>
                {/* Wind Vector Pointer */}
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="18"
                  stroke="#52bfff"
                  strokeWidth="1.8"
                  transform={`rotate(${weatherState.windDeg})`}
                  strokeLinecap="round"
                />
              </g>
            </g>
          </svg>
        </div>

        {/* ── Zoom Controls Overlay ── */}
        <div className="spatial-zoom-controls">
          <button onClick={() => setZoom((z) => Math.min(1.75, +(z + 0.1).toFixed(2)))} title="Zoom In">
            <Plus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.1).toFixed(2)))} title="Zoom Out">
            <Minus size={14} />
          </button>
          <button onClick={resetView} title="Reset Scale & Pan">
            RESET
          </button>
        </div>

        {/* ── Canvas Usage Hint ── */}
        <div className="spatial-usage-hint">
          <span>DRAG TO PAN · MOUSE WHEEL TO ZOOM · CLICK ANY ZONE FOR DEEP TELEMETRY</span>
        </div>
      </div>
    ) : (
      /* ── True 3D Volumetric Digital Twin View (Three.js WebGL) ── */
      <div className="spatial-canvas-wrap fade-enter">
        <VolumetricTwin3D
          engine={engine}
          weather={weather}
          stationInfo={stationInfo}
          zonesDef={ZONES_DEF}
          zoneStatus={zoneStatus}
          onSelectZone={setSelectedZone}
          onHoverZone={setHoveredZone}
        />
      </div>
    )}

    {/* ── Floating Hover Card (Shared across 2D & 3D) ── */}
    {hoveredZone && (
      <div className="spatial-hover-card">
        <div className="spatial-hover-head">
          <Crosshair size={13} className="cyan-icon" />
          <b>{hoveredZone.name}</b>
          <span className="spatial-hover-code">{hoveredZone.code}</span>
        </div>
        <div className="spatial-hover-body">
          <div><span>DISTANCE:</span><b>{hoveredZone.distance}</b></div>
          <div><span>ELEVATION:</span><b>{hoveredZone.elevation}</b></div>
          <div><span>STATUS:</span><b className={`text-${zoneStatus[hoveredZone.id]?.tone || "ok"}`}>{zoneStatus[hoveredZone.id]?.state || "NORMAL"}</b></div>
          <div><span>LOAD:</span><b>{zoneStatus[hoveredZone.id]?.metric || "--"}</b></div>
        </div>
        <div className="spatial-hover-hint">CLICK MODULE TO OPEN SYSTEM DIAGNOSTICS</div>
      </div>
    )}
  </div>

      {/* ── Deep Zone Telemetry Modal / Drawer ── */}
      {selectedZone && (
        <div className="modal-backdrop" onClick={() => setSelectedZone(null)}>
          <div className="modal spatial-inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="spatial-inspector-header">
              <div className="spatial-modal-title">
                <span className="eyebrow">{selectedZone.code} // SECTOR DIAGNOSTICS</span>
                <h3>{selectedZone.name}</h3>
                <span className="spatial-subtitle">{selectedZone.subtitle}</span>
              </div>
              <button className="icon-btn modal-close" onClick={() => setSelectedZone(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* Quick KPI Strip */}
            <div className="spatial-inspector-kpis">
              <div>
                <span>STATUS</span>
                <b className={`text-${zoneStatus[selectedZone.id]?.tone || "ok"}`}>
                  {zoneStatus[selectedZone.id]?.state || "NORMAL"}
                </b>
              </div>
              <div>
                <span>DISTANCE</span>
                <b>{selectedZone.distance}</b>
              </div>
              <div>
                <span>ELEVATION</span>
                <b>{selectedZone.elevation}</b>
              </div>
              <div>
                <span>POWER LOAD</span>
                <b>{zoneStatus[selectedZone.id]?.loadKW?.toFixed(1) || "12.0"} kW</b>
              </div>
              <div>
                <span>RISK VECTOR</span>
                <b>{zoneStatus[selectedZone.id]?.risk || "LOW"}</b>
              </div>
            </div>

            {/* Sector Architectural Description */}
            <div className="spatial-inspector-desc">
              <p>{selectedZone.description}</p>
            </div>

            {/* Subsystems Breakdown Table */}
            <div className="spatial-subsystems-panel">
              <div className="spatial-subsystems-head">
                <Wrench size={13} className="cyan-icon" />
                <b>CRITICAL SUBSYSTEMS & CIRCUIT BREAKERS</b>
              </div>
              <div className="spatial-subsystems-list">
                {selectedZone.subsystems.map((sub, idx) => (
                  <div key={idx} className="spatial-subsystem-row">
                    <div className="sub-left">
                      <span className="sub-dot ok" />
                      <b>{sub.name}</b>
                    </div>
                    <span className="sub-note">{sub.note}</span>
                    <span className="sub-load">{sub.load}</span>
                    <span className="sub-status ok">{sub.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="spatial-inspector-footer">
              <span>FACILITY TELEMETRY: <b>3s LOOP SYNCED</b></span>
              <button className="primary-btn" onClick={() => setSelectedZone(null)}>
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
