import React, { useMemo, useState } from "react";
import { Box, Crosshair, Layers3, Minus, Plus, Rotate3D, Snowflake, Thermometer, Zap } from "lucide-react";

const zones = [
  { id: "generator", name: "GENERATOR BAY", x: 0, y: 0, w: 150, h: 90, distance: "24 m", accent: "cyan" },
  { id: "habitat", name: "MAIN HABITAT", x: 175, y: 22, w: 210, h: 120, distance: "0 m", accent: "green" },
  { id: "fuel", name: "FUEL RESERVE", x: 410, y: 5, w: 145, h: 92, distance: "38 m", accent: "amber" },
  { id: "lab", name: "LAB POD A", x: 435, y: 116, w: 120, h: 65, distance: "47 m", accent: "blue" },
];

export default function DigitalTwin3D({ engine }) {
  const [view, setView] = useState("perspective");
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rotation, setRotation] = useState({ x: 8, y: -14 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [last, setLast] = useState({ x: 0, y: 0 });

  const statusFor = (zone) => {
    if (zone.id === "generator" && engine.generatorStatus === "CRITICAL") return "CRITICAL";
    if (zone.id === "fuel" && engine.ambientTemp < -35) return "WARNING";
    return "NORMAL";
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    setRotation(r => ({ x: Math.max(-28, Math.min(28, r.x - dy * 0.35)), y: r.y + dx * 0.35 }));
    setLast({ x: e.clientX, y: e.clientY });
  };

  const transform = useMemo(() => view === "top" ? `scale(${zoom}) rotateX(72deg) rotateZ(${rotation.y}deg)` : `scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(-2deg)`, [rotation, view, zoom]);

  return <section className="panel twin3d-panel" id="digital-twin">
    <div className="panel-head">
      <div><span className="eyebrow">3D DIGITAL TWIN / INTERACTIVE</span><h2>Station spatial model</h2></div>
      <div className="twin-toolbar"><button className={view === "perspective" ? "active" : ""} onClick={() => setView("perspective")}><Rotate3D size={13}/> 3D</button><button className={view === "top" ? "active" : ""} onClick={() => setView("top")}><Layers3 size={13}/> TOP</button></div>
    </div>
    <div className="twin-stage-advanced" onPointerDown={(e) => { setDragging(true); setLast({ x:e.clientX, y:e.clientY }); e.currentTarget.setPointerCapture?.(e.pointerId); }} onPointerMove={handlePointerMove} onPointerUp={() => setDragging(false)} onPointerLeave={() => setDragging(false)}>
      <div className="twin-stars"/><div className="twin-grid-floor"/>
      <div className="twin-model" style={{ transform }}>
        <div className="twin-platform"/>
        {zones.map(zone => <button key={zone.id} className={`twin-zone ${zone.accent} ${statusFor(zone).toLowerCase()}`} style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }} onMouseEnter={() => setHovered(zone)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected(zone)}><span className="zone-light"/><b>{zone.name}</b><small>{statusFor(zone)}</small></button>)}
        <div className="twin-roof"/><div className="twin-antenna"><i/><i/><i/></div><div className="twin-connector c1"/><div className="twin-connector c2"/>
      </div>
      <div className="twin-readout readout-temp"><Thermometer size={13}/><span>AMBIENT</span><b>{engine.ambientTemp.toFixed(1)}°C</b></div>
      <div className="twin-readout readout-env"><Snowflake size={13}/><span>{engine.viscosityRisk ? "VISCOSITY RISK" : engine.scenario !== "NORMAL" ? engine.scenario : "ENVIRONMENT NOMINAL"}</span></div>
      <div className="twin-readout readout-power"><Zap size={13}/><span>LOAD</span><b>{engine.powerLoadKW.toFixed(0)} kW</b></div>
      {hovered && <div className="twin-hover-card"><Crosshair size={13}/><div><b>{hovered.name}</b><span>{hovered.distance} from mission control · click to inspect</span></div></div>}
      <div className="twin-controls-float"><button onClick={() => setZoom(z => Math.min(1.35, z + .08))}><Plus size={14}/></button><span>{Math.round(zoom*100)}%</span><button onClick={() => setZoom(z => Math.max(.78, z - .08))}><Minus size={14}/></button><button onClick={() => setRotation({x:8,y:-14})}>RESET</button></div>
      <div className="twin-hint">DRAG TO ORBIT · HOVER ZONES FOR DISTANCE · CLICK TO INSPECT</div>
    </div>
    {selected && <div className="twin-inspector"><div><span className="eyebrow">ZONE INSPECTOR</span><h3>{selected.name}</h3></div><span className={`status-pill ${statusFor(selected).toLowerCase()}`}>{statusFor(selected)}</span><div className="twin-inspector-meta"><span>DISTANCE <b>{selected.distance}</b></span><span>TEMP <b>{engine.ambientTemp.toFixed(1)}°C</b></span><span>SCENARIO <b>{engine.scenario}</b></span></div><button onClick={() => setSelected(null)}>CLOSE</button></div>}
  </section>;
}
