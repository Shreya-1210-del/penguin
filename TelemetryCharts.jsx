import React from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Flame, Gauge, Thermometer, Zap } from "lucide-react";

function MiniStat({ icon: Icon, label, value, unit, tone }) { return <div className={`mini-stat ${tone}`}><div className="mini-icon"><Icon size={17}/></div><div><span>{label}</span><strong>{value}<em>{unit}</em></strong></div></div>; }
const tooltip = { background: "#07111c", border: "1px solid #254156", borderRadius: 8, fontSize: 11 };

export default function TelemetryCharts({ history, ambientTemp, powerDraw, actualBurnRate, currentFuel, capacity }) {
  const data = history && history.length > 0 ? history : [{ time: "--:--", temperature: ambientTemp, fuel: currentFuel, burnRate: actualBurnRate, power: powerDraw }];
  const percent = Math.max(0, Math.min(100, (currentFuel / capacity) * 100));

  return <section className="panel telemetry-panel" id="telemetry">
    <div className="panel-head"><div><span className="eyebrow">SYSTEM HEALTH</span><h2>Live telemetry</h2></div><div className="panel-live"><i/> STREAMING / 2s</div></div>
    <div className="mini-stats"><MiniStat icon={Thermometer} label="Ambient" value={ambientTemp.toFixed(1)} unit="°C" tone="cyan"/><MiniStat icon={Flame} label="Burn rate" value={actualBurnRate.toFixed(0)} unit=" L/day" tone="amber"/><MiniStat icon={Zap} label="Power draw" value={powerDraw.toFixed(0)} unit="%" tone="green"/></div>
    <div className="chart-grid chart-grid-three">
      <div className="chart-box"><div className="chart-label"><span><Thermometer size={14}/> AMBIENT TEMPERATURE</span><b>{data.length} samples</b></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#183044" strokeDasharray="3 5"/><XAxis dataKey="time" tick={{fill:"#607f96",fontSize:9}} tickLine={false} axisLine={false}/><YAxis domain={["auto","auto"]} tick={{fill:"#607f96",fontSize:9}} tickLine={false} axisLine={false} width={40}/><Tooltip contentStyle={tooltip}/><Line type="monotone" dataKey="temperature" stroke="#52bfff" strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></div>
      <div className="chart-box"><div className="chart-label"><span><Gauge size={14}/> GENERATOR LOAD</span><b>{powerDraw.toFixed(0)}%</b></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#183044" strokeDasharray="3 5"/><XAxis dataKey="time" tick={{fill:"#607f96",fontSize:9}} tickLine={false} axisLine={false}/><YAxis domain={[0,100]} tick={{fill:"#607f96",fontSize:9}} tickLine={false} axisLine={false} width={30}/><Tooltip contentStyle={tooltip}/><Line type="monotone" dataKey="power" stroke="#2ed6a1" strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></div>
      <div className="chart-box"><div className="chart-label"><span><Flame size={14}/> FUEL / BURN TREND</span><b>{actualBurnRate.toFixed(0)} L/day</b></div><div className="fuel-gauge"><div className="gauge-track"><div className="gauge-fill" style={{width:`${percent}%`}}/></div><div className="gauge-numbers"><span>0 L</span><strong>{Math.round(currentFuel).toLocaleString()} L</strong><span>{capacity.toLocaleString()} L</span></div></div><div className="chart chart-short"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><XAxis dataKey="time" hide/><YAxis hide domain={["auto","auto"]}/><Tooltip contentStyle={tooltip}/><Area type="monotone" dataKey="burnRate" stroke="#f59e0b" fill="url(#burnArea)" strokeWidth={2} isAnimationActive={false} dot={false}/></AreaChart></ResponsiveContainer></div></div>
    </div>
    <svg width="0" height="0" aria-hidden="true"><defs><linearGradient id="fuelArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ed6a1" stopOpacity=".35"/><stop offset="100%" stopColor="#2ed6a1" stopOpacity="0"/></linearGradient><linearGradient id="burnArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity=".35"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></linearGradient></defs></svg>
  </section>;
}
