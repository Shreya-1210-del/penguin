import React, { useMemo } from "react";
import { Radio, Satellite, Signal } from "lucide-react";

export default function SatelliteOrbit({ satSync }) {
  const passes = useMemo(() => [
    { name: "POLAR-01", eta: "04:18", duration: "08m", strength: 92 },
    { name: "POLAR-02", eta: "06:47", duration: "11m", strength: 78 },
    { name: "POLAR-03", eta: "09:12", duration: "07m", strength: 64 },
  ], []);
  return <section className="panel orbit-panel" id="orbit"><div className="panel-head"><div><span className="eyebrow">SATELLITE ORBIT MAP</span><h2>Uplink pass windows</h2></div><Satellite size={18} className="blue-icon" /></div><div className="orbit-map"><div className="orbit-earth"><div className="orbit-ice"/><span>BHARATI</span></div><div className="orbit-ring ring-1"/><div className="orbit-ring ring-2"/><div className="orbit-ring ring-3"/><div className="orbit-sat sat-1"><Radio size={13}/></div><div className="orbit-sat sat-2"><Radio size={13}/></div><div className="orbit-sat sat-3"><Radio size={13}/></div></div><div className="pass-list">{passes.map((p) => <div className="pass-row" key={p.name}><span><Signal size={13}/>{p.name}</span><b>{p.eta}</b><small>{p.duration} · {p.strength}%</small></div>)}</div><div className="orbit-note">{satSync ? "SatSync active: prioritize critical delta packets during the next pass." : "Local mode: full telemetry remains available to the operator."}</div></section>;
}
