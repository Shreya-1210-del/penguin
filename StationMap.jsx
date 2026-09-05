import React, { useState } from "react";
import { Activity, Flame, Home, X, Zap } from "lucide-react";

const STATUS = {
  ok: { label: "NOMINAL", fill: "#2ed6a1", glow: "rgba(46,214,161,.32)" },
  warning: { label: "WARNING", fill: "#f4b64b", glow: "rgba(244,182,75,.3)" },
  critical: { label: "CRITICAL", fill: "#ff5d69", glow: "rgba(255,93,105,.35)" },
};

export default function StationMap({ generatorStatus, ambientTemp, currentFuel, powerDraw, id }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);

  const generatorState = generatorStatus === "CRITICAL" || powerDraw >= 100 ? "critical" : powerDraw > 90 ? "warning" : "ok";
  const fuelState = ambientTemp < -35 ? "warning" : "ok";
  const livingState = "ok";

  const sectors = {
    generator: {
      title: "Generator Bay",
      state: generatorState,
      icon: Zap,
      detail: generatorStatus === "CRITICAL"
        ? "Generator 1 reports a critical mechanical fault. Auxiliary load is being maintained while recovery is attempted."
        : "Primary generation is online and operating within the nominal simulation envelope.",
      metric: `${Math.round(powerDraw)}% load`,
    },
    fuel: {
      title: "Fuel Storage",
      state: fuelState,
      icon: Flame,
      detail: ambientTemp <= -35
        ? "Cold-weather condition active. Fuel reserve is exposed to elevated burn demand."
        : "Fuel reserve is stable. Storage telemetry is within the nominal simulation range.",
      metric: `${Math.round((currentFuel / 500000) * 100)}% reserve`,
    },
    habitat: {
      title: "Main Habitat",
      state: livingState,
      icon: Home,
      detail: generatorStatus === "CRITICAL"
        ? "Habitat systems remain online; generator fault is being tracked as a mission-critical dependency."
        : "Habitat systems are nominal and protected by the current power envelope.",
      metric: "+21°C HVAC target",
    },
  };

  const drawSector = (key, x, width, label, number) => {
    const sector = sectors[key];
    const style = STATUS[sector.state];
    const Icon = sector.icon;
    const distances = { generator: "24 m", habitat: "0 m", fuel: "38 m" };
    return (
      <g
        key={key}
        className={`sector ${sector.state === "critical" ? "sector-critical" : ""}`}
        onClick={() => setSelected(sector)}
        onMouseEnter={() => setHovered({ key, sector, distance: distances[key] })}
        onMouseLeave={() => setHovered(null)}
        role="button"
        tabIndex="0"
        onKeyDown={(e) => e.key === "Enter" && setSelected(sector)}
      >
        <rect x={x} y="54" width={width} height="154" rx="12" fill="#0d1b28" stroke="#21384b" />
        <rect x={x + 6} y="60" width={width - 12} height="142" rx="9" fill={style.fill} opacity=".94" />
        <rect x={x + 6} y="60" width={width - 12} height="142" rx="9" fill={`url(#${key}Glow)`} opacity=".25" />
        <circle cx={x + 24} cy="78" r="5" fill={style.fill} />
        <text x={x + 38} y="82" className="svg-micro">{style.label}</text>
        <text x={x + width / 2} y="127" textAnchor="middle" className="svg-number">{number}</text>
        <text x={x + width / 2} y="154" textAnchor="middle" className="svg-label">{label}</text>
        <foreignObject x={x + width / 2 - 13} y="166" width="26" height="26">
          <div className="svg-icon-wrap"><Icon size={22} /></div>
        </foreignObject>
      </g>
    );
  };

  const SelectedIcon = selected?.icon || Activity;

  return (
    <section className="panel station-panel" id={id || "station-map"}>
      <div className="panel-head">
        <div>
          <span className="eyebrow">VISUAL DIGITAL TWIN</span>
          <h2>Station schematic</h2>
        </div>
        <div className="panel-live"><i /> LIVE MAP</div>
      </div>

      <div className="station-svg-wrap">
        <svg viewBox="0 0 900 270" className="station-svg" aria-label="Interactive Bharati station schematic">
          <defs>
            <linearGradient id="generatorGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2ed6a1" /><stop offset="1" stopColor="#153d45" /></linearGradient>
            <linearGradient id="fuelGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4b64b" /><stop offset="1" stopColor="#493b1e" /></linearGradient>
            <linearGradient id="habitatGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2ed6a1" /><stop offset="1" stopColor="#153d45" /></linearGradient>
            <filter id="softGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {hovered && <g className="svg-distance-tooltip"><rect x="325" y="10" width="250" height="34" rx="7" fill="#06131e" stroke="#315e78"/><text x="340" y="24" className="svg-micro">DISTANCE FROM MISSION CONTROL</text><text x="560" y="34" textAnchor="end" className="svg-distance-value">{hovered.distance}</text></g>}
          <path d="M80 232 H820" stroke="#183245" strokeWidth="2" />
          <path d="M125 232 V218 M775 232 V218 M450 232 V218" stroke="#27495d" strokeWidth="2" />
          <text x="450" y="255" textAnchor="middle" className="svg-coordinate">BHARATI STATION / SCHEMATIC FLOORPLAN / NOT TO SCALE</text>

          <rect x="55" y="116" width="790" height="52" rx="20" fill="#08121d" stroke="#284357" />
          <path d="M75 142 H825" stroke="#173044" strokeDasharray="4 10" />
          {drawSector("generator", 70, 220, "GENERATOR BAY", "G-01")}
          {drawSector("habitat", 340, 220, "LIVING QUARTERS", "H-01")}
          {drawSector("fuel", 610, 220, "FUEL STORAGE", "F-01")}

          <g filter="url(#softGlow)">
            <circle cx="180" cy="218" r="3" fill="#52bfff" />
            <circle cx="450" cy="218" r="3" fill="#52bfff" />
            <circle cx="720" cy="218" r="3" fill="#52bfff" />
          </g>
        </svg>
        <div className="map-hint"><Activity size={13} /> Hover a module for distance · click to inspect live status</div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal station-modal" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button>
            <div className="modal-kicker"><SelectedIcon size={16} /> MODULE TELEMETRY</div>
            <h3>{selected.title}</h3>
            <div className={`modal-status ${selected.state}`}>{STATUS[selected.state].label}</div>
            <p>{selected.detail}</p>
            <div className="detail-metric"><span>LIVE METRIC</span><strong>{selected.metric}</strong></div>
          </div>
        </div>
      )}
    </section>
  );
}