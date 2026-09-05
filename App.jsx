import React, { useMemo, useState } from "react";
import { Activity, ArrowRight, Bell, Box, BrainCircuit, Code2, Compass, Database, Gauge, Layers3, MapPin, Menu, PackageCheck, Radio, Ruler, Satellite, ShieldCheck, Siren, Snowflake, Thermometer, Waves, Wifi, X, Zap } from "lucide-react";
import { useAntarcticEngine } from "./useAntarcticEngine";
import StationMap from "./StationMap";
import SatSyncCard from "./SatSyncCard";
import DemoControls from "./DemoControls";
import TelemetryCharts from "./TelemetryCharts";
import ResourceLogistics from "./ResourceLogistics";
import PredictiveAnalytics from "./PredictiveAnalytics";
import SatelliteOrbit from "./SatelliteOrbit";
import DigitalTwin3D from "./DigitalTwin3D";
import { getCompressedPayload, getPayloadMetrics, getRawPayload } from "./satSyncUtils";

const stations = {
  BHARATI: { name: "BHARATI", coords: "69°24′ S / 76°11′ E", image: "https://www.ncpor.res.in/files/images/Bharati%20%282%29.jpg", fallback: "/assets/antarctic-mountain-design.jpg" },
  MAITRI: { name: "MAITRI", coords: "70°45′ S / 11°44′ E", image: "https://ncps.ncpor.res.in/expedition/image/Maitri.JPG", fallback: "/assets/antarctic-mountain-design.jpg" }
};

function Metric({ icon: Icon, label, value }) { return <div className="strip-metric"><Icon size={20}/><div><span>{label}</span><b>{value}</b><small>LIVE</small></div></div>; }
function StateRow({ label, value }) { const tone = value === "CRITICAL" ? "critical" : value === "WARNING" || value === "ACTIVE" ? "warning" : "ok"; return <div className="state-row"><span><i className={tone}/>{label}</span><b className={tone}>{value}</b></div>; }

const featureButtons = [
  { id: "fuel-engine", title: "Dynamic Fuel & Physics", desc: "3-second mock physics loop using the documented cold multiplier, generator count, scenario penalty and 120,000 L reserve.", icon: FuelIcon },
  { id: "station-map", title: "Interactive 2D Station Map", desc: "Click Generator Bay, Fuel Storage or Living Quarters. Hover for distance and inspect live state.", icon: MapPin },
  { id: "scenario", title: "Emergency What-If Simulator", desc: "Run Blizzard Level 5, Primary Generator Failure and reset scenarios with cascading effects.", icon: Siren },
  { id: "telemetry", title: "Command Dashboard & Analytics", desc: "Rolling telemetry, power versus load, environment trends, alerts and operational KPIs.", icon: Activity },
  { id: "digital-twin", title: "Interactive 3D Digital Twin", desc: "Drag to orbit, zoom, switch view modes and inspect station zones in a visual 3D scene.", icon: Layers3 },
  { id: "satsync", title: "SatSync", desc: "Switch between local high-resolution telemetry and simulated compressed satellite transmission.", icon: Satellite },
  { id: "payload", title: "Payload Inspector", desc: "Compare raw JSON and compact transmission payloads with live byte metrics.", icon: Database },
  { id: "analytics", title: "Predictive Analytics", desc: "Forecast reserve depletion and visualize rolling risk trends.", icon: BrainCircuit },
  { id: "logistics", title: "Resource & Logistics", desc: "Backend-ready resource records for station reserves and operational planning.", icon: PackageCheck },
  { id: "orbit", title: "Satellite Pass Windows", desc: "Visualize communications windows and current SatSync priority state.", icon: Radio },
  { id: "backend", title: "Backend Integration Boundary", desc: "Clear telemetry contract for later REST, WebSocket, MQTT and weather API integration.", icon: Code2 },
];

function FuelIcon(props) { return <Gauge {...props}/>; }

function App() {
  const engine = useAntarcticEngine();
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [station, setStation] = useState("BHARATI");
  const stationInfo = stations[station];
  const fuelPercent = (engine.currentFuel / engine.fuelTankCapacity) * 100;
  const tone = engine.survivalDays < 15 ? "danger" : engine.survivalDays < 30 ? "warning" : "good";
  const metrics = useMemo(() => getPayloadMetrics(engine), [engine.currentFuel, engine.ambientTemp, engine.generatorStatus, engine.actualBurnRate, engine.survivalDays, engine.powerLoadKW]);
  const rawPayload = useMemo(() => JSON.stringify(getRawPayload(engine), null, 2), [engine.currentFuel, engine.ambientTemp, engine.generatorStatus, engine.actualBurnRate, engine.survivalDays, engine.powerLoadKW]);
  const compressedPayload = useMemo(() => getCompressedPayload(engine), [engine.currentFuel, engine.ambientTemp, engine.generatorStatus]);
  const nav = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return <div className="app-shell"><div className="scanlines"/>
    <header className="topbar">
      <div className="brand"><div className="penguin-mark"><div className="penguin-head"><span/></div><div className="penguin-body"><i/><i/></div></div><div><div className="brand-name">PENGUIN</div><div className="brand-sub">ANTARCTIC DIGITAL TWIN</div></div></div>
      <nav className={`nav-links ${menuOpen ? "open" : ""}`}><button onClick={() => nav("overview")}>OVERVIEW</button><button onClick={() => nav("features")}>FEATURES</button><button onClick={() => nav("telemetry")}>TELEMETRY</button><button onClick={() => nav("digital-twin")}>DIGITAL TWIN</button><button onClick={() => nav("satsync")}>SATSYNC</button></nav>
      <div className="top-actions"><div className="live-badge"><i/> LIVE STATUS</div><button className="features-btn" onClick={() => setFeaturesOpen(true)}><Layers3 size={15}/> FEATURES</button><button className="payload-btn" onClick={() => setPayloadOpen(true)}><Code2 size={15}/> INSPECT</button><button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X/> : <Menu/>}</button></div>
    </header>

    <main>
      <section className="hero" id="overview">
        <div className="hero-copy"><div className="hero-kicker">INDIA'S POLAR PRESENCE / <b>MISSION CONTROL</b></div><h1>Exploring.<br/>Understanding.<br/><em>Protecting.</em></h1><div className="hero-rule"/><p>A digital twin for remote management and monitoring of India's Antarctic research stations, built around fuel endurance, environmental stress, generation health and low-bandwidth satellite operations.</p><div className="hero-actions"><button className="primary-btn" onClick={() => nav("telemetry")}>OPEN LIVE TELEMETRY <ArrowRight size={17}/></button><button className="ghost-btn" onClick={() => nav("digital-twin")}><Box size={16}/> ENTER 3D TWIN</button><button className="ghost-btn" onClick={() => setFeaturesOpen(true)}><Layers3 size={16}/> ALL FEATURES</button></div></div>
        <div className="hero-visual"><div className="hero-mountains"/><div className="hero-visual-vignette"/><div className="hero-grid"/><div className="hero-depth-glow"/><div className="hero-distance-pin pin-maitri"><span/><label>MAITRI STATION<br/><b>70°45′ S / 11°44′ E</b></label><div className="hero-distance"><Ruler size={12}/> 3,496 km from Bharati</div></div><div className="hero-distance-pin pin-bharati"><span/><label>BHARATI STATION<br/><b>69°24′ S / 76°11′ E</b></label><div className="hero-distance"><Ruler size={12}/> 0 km reference</div></div><div className="hero-visual-tag">FIELD DIGITAL TWIN / LIVE MOCK TELEMETRY</div></div>
      </section>

      <section className="status-strip"><div className="status-lead"><i className={engine.generatorStatus === "CRITICAL" ? "critical" : engine.ambientTemp < -35 ? "warning" : "nominal"}/><div><b>{engine.generatorStatus === "CRITICAL" ? "SYSTEM DEGRADED" : engine.ambientTemp < -35 ? "WEATHER WARNING" : "SYSTEMS NOMINAL"}</b><span>{engine.generatorStatus === "CRITICAL" ? "Primary generator failure simulation active" : engine.ambientTemp < -35 ? "Extreme cold threshold exceeded" : "Mock telemetry stream within baseline envelope"}</span></div></div><Metric icon={Thermometer} label="TEMPERATURE" value={`${engine.ambientTemp.toFixed(1)}°C`}/><Metric icon={Waves} label="BURN RATE" value={`${engine.actualBurnRate.toFixed(1)} L/h`}/><Metric icon={Zap} label="POWER LOAD" value={`${engine.powerLoadKW.toFixed(0)} kW`}/><Metric icon={Wifi} label="SATELLITE LINK" value={engine.isSatSyncMode ? "SATSYNC" : "LOCAL"}/></section>

      <section className="feature-rail" id="features"><div className="section-head"><div><span className="eyebrow">PENGUIN / FEATURE CONTROL</span><h2>Every capability, one click away</h2><p>These controls map directly to the prototype features and keep the UI ready for backend wiring later.</p></div><button className="small-btn" onClick={() => setFeaturesOpen(true)}>OPEN FULL FEATURE INDEX <ArrowRight size={14}/></button></div><div className="feature-button-grid">{featureButtons.map(({id,title,desc,icon:Icon}) => <button className="feature-button" key={id} onClick={() => id === "payload" ? setPayloadOpen(true) : nav(id)}><span className="feature-button-icon"><Icon size={17}/></span><span><b>{title}</b><small>{desc}</small></span><ArrowRight size={14}/></button>)}</div></section>

      <section className="dashboard-grid">
        <div className="dashboard-left">
          <section className={`survival-card ${tone}`} id="fuel-engine"><div className="survival-top"><div><span className="eyebrow">1 / DYNAMIC FUEL & PHYSICS ENGINE</span><h2>Estimated station survival</h2><p className="section-note">45 L/h per active generator · cold multiplier below -20°C · critical fuel alert below 15 days</p></div><div className="station-selector"><span>STATION</span><button onClick={() => setStation(station === "BHARATI" ? "MAITRI" : "BHARATI")}>{stationInfo.name}<small>{stationInfo.coords}</small></button></div></div><div className="survival-number"><strong>{engine.survivalDays.toFixed(1)}</strong><span>DAYS</span></div><div className="formula-row"><span>BASE {engine.baseBurnRatePerGenerator} L/h × {engine.activeGenerators} GEN × {engine.coldMultiplier.toFixed(3)} COLD × {engine.scenarioPenaltyMultiplier.toFixed(2)} SCENARIO</span><b>{engine.actualBurnRate.toFixed(1)} L/h</b></div><div className="survival-meta"><span><FuelIcon size={14}/>{Math.round(engine.currentFuel).toLocaleString()} L remaining</span><span><Thermometer size={14}/>{engine.ambientTemp.toFixed(1)}°C ambient</span><span><Gauge size={14}/>{engine.dailyBurnRate.toFixed(0)} L/day</span></div><div className="survival-bar"><span style={{ width: `${Math.max(0, Math.min(100, fuelPercent))}%` }}/></div><div className="survival-foot"><span>4 TANKS / 120,000 L INITIAL MOCK STORAGE</span><b>{fuelPercent.toFixed(1)}%</b></div></section>
          <StationMap generatorStatus={engine.generatorStatus} ambientTemp={engine.ambientTemp} currentFuel={engine.currentFuel} powerDraw={engine.powerDraw} id="station-map"/>
          <TelemetryCharts history={engine.history} ambientTemp={engine.ambientTemp} powerDraw={engine.powerDraw} actualBurnRate={engine.dailyBurnRate} currentFuel={engine.currentFuel} capacity={engine.fuelTankCapacity}/>
          <DigitalTwin3D engine={engine}/>
        </div>
        <aside className="dashboard-right">
          <section className="panel mission-panel"><div className="panel-head"><div><span className="eyebrow">CENTRAL COMMAND DASHBOARD</span><h2>Operational state</h2></div><ShieldCheck size={18} className="green-icon"/></div><div className="state-list"><StateRow label="Generator Bay" value={engine.generatorStatus}/><StateRow label="Fuel Storage" value={engine.ambientTemp < -35 ? "WARNING" : "NORMAL"}/><StateRow label="Living Quarters" value="NORMAL"/><StateRow label="Blizzard" value={engine.ambientTemp < -35 ? "ACTIVE" : "STANDBY"}/><StateRow label="Viscosity Risk" value={engine.viscosityRisk ? "WARNING" : "NORMAL"}/></div><div className="kpi-grid"><div><span>EFFICIENCY INDEX</span><b>{engine.efficiencyIndex.toFixed(1)}%</b></div><div><span>ACTIVE GENERATORS</span><b>{engine.activeGenerators}/3</b></div><div><span>SCENARIO</span><b>{engine.scenario}</b></div><div><span>FUEL ALERT</span><b>{engine.survivalDays < 15 ? "CRITICAL" : "CLEAR"}</b></div></div></section>
          <section className="panel station-profile"><div className="panel-head"><div><span className="eyebrow">REAL FIELD IMAGE / NCPOR</span><h2>{stationInfo.name}</h2></div><Compass size={18} className="blue-icon"/></div><div className="profile-photo"><img src={stationInfo.image} alt={`${stationInfo.name} field station`} onError={(e) => { if (e.currentTarget.dataset.fallback !== "1") { e.currentTarget.dataset.fallback = "1"; e.currentTarget.src = stationInfo.fallback; } else { e.currentTarget.style.opacity = "0"; e.currentTarget.parentElement.classList.add("image-failed"); } }}/><div className="image-fallback"><Snowflake size={20}/><span>FIELD IMAGE FALLBACK</span><small>Local Antarctic design asset active</small></div><div className="profile-overlay"><b>{stationInfo.name}</b><span>{stationInfo.coords}</span></div></div></section>
          <section className="panel protocol-panel"><div className="panel-head"><div><span className="eyebrow">LOW BANDWIDTH PROTOCOL</span><h2>SatSync</h2></div><Radio size={18} className={engine.isSatSyncMode ? "green-icon" : "blue-icon"}/></div><div className="protocol-main"><div className="protocol-big">{engine.isSatSyncMode ? "COMPACT" : "LOCAL"}<small>{engine.isSatSyncMode ? `${metrics.reduction.toFixed(1)}% smaller` : "HIGH RES"}</small></div><div><span>{engine.isSatSyncMode ? "critical deltas only" : "full operator telemetry"}</span><b>{engine.isSatSyncMode ? `${metrics.compressedBytes} B packet` : `${metrics.rawBytes} B raw`}</b></div></div><button className="wide-btn" onClick={() => nav("satsync")}>{engine.isSatSyncMode ? "INSPECT SATSYNC" : "ACTIVATE SATSYNC MODE"}<ArrowRight size={15}/></button></section>
          <section className="panel log-panel" id="events"><div className="panel-head"><div><span className="eyebrow">ALERT MEMORY</span><h2>Live event log</h2></div><Bell size={17} className="blue-icon"/></div><div className="log-list">{engine.logs.map(log => <div className="log-row" key={log.id}><span className={`log-dot ${log.type}`}/><time>{log.time}</time><p>{log.message}</p></div>)}</div></section>
        </aside>
      </section>

      <SatSyncCard engine={engine}/>
      <section className="advanced-grid"><div id="analytics"><PredictiveAnalytics history={engine.history} currentFuel={engine.currentFuel} burnRate={engine.dailyBurnRate}/></div><div id="orbit"><SatelliteOrbit satSync={engine.isSatSyncMode}/></div></section>
      <div id="logistics"><ResourceLogistics/></div>
      <section className="panel backend-ready" id="backend"><div className="panel-head"><div><span className="eyebrow">BACKEND-READY ARCHITECTURE</span><h2>Integration contract</h2></div><Code2 size={18} className="blue-icon"/></div><div className="backend-contract"><div><span>TELEMETRY</span><b>REST / WebSocket / MQTT adapter boundary</b></div><div><span>WEATHER</span><b>Open-Meteo / IMD model integration point</b></div><div><span>STATION IO</span><b>BMS / BACnet-IP / SCADA telemetry boundary</b></div><div><span>TIME SERIES</span><b>InfluxDB-ready storage contract</b></div></div></section>
      <section className="field-gallery" id="stations"><div className="gallery-head"><div><span className="eyebrow">FIELD IMAGERY / REAL STATIONS</span><h2>India's Antarctic footprint</h2></div><span className="gallery-note">Remote image sources use NCPOR URLs with local fallback assets.</span></div><div className="gallery-3d-scene"><PhotoCard station={stations.MAITRI} code="STN-01"/><PhotoCard station={stations.BHARATI} code="STN-02"/><PhotoCard station={stations.BHARATI} code="STN-02 / FIELD"/></div></section>
      <footer className="footer"><span>PENGUIN / DIGITAL TWIN PROTOTYPE</span><span>3s MOCK PHYSICS LOOP <b>●</b></span><span>VISUAL DATA IS SIMULATED FOR DEMONSTRATION</span></footer>
    </main>

    <DemoControls engine={engine}/>
    {featuresOpen && <FeatureMenu onClose={() => setFeaturesOpen(false)} nav={nav} openPayload={() => { setFeaturesOpen(false); setPayloadOpen(true); }} />}
    {payloadOpen && <div className="modal-backdrop" onClick={() => setPayloadOpen(false)}><div className="modal payload-modal" onClick={(e) => e.stopPropagation()}><button className="icon-btn modal-close" onClick={() => setPayloadOpen(false)}><X/></button><div className="modal-kicker"><Code2 size={15}/> PAYLOAD INSPECTOR</div><h3>Active transmission payload</h3><div className="inspect-tabs"><span className={!engine.isSatSyncMode ? "active" : ""}>LOCAL {metrics.rawBytes} B</span><span className={engine.isSatSyncMode ? "active" : ""}>SATSYNC {metrics.compressedBytes} B</span></div><pre>{engine.isSatSyncMode ? compressedPayload : rawPayload}</pre><div className="inspect-footer"><span>simulated bandwidth reduction</span><b>{metrics.reduction.toFixed(2)}%</b></div></div></div>}
  </div>;
}

function FeatureMenu({ onClose, nav, openPayload }) { return <div className="feature-overlay" onClick={onClose}><div className="feature-drawer" onClick={e => e.stopPropagation()}><div className="feature-head"><div><span className="eyebrow">PENGUIN / SYSTEM CAPABILITIES</span><h3>Complete feature index</h3><p>All primary PDF features plus the extended prototype modules are directly accessible.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="feature-grid">{featureButtons.map(({id,title,desc,icon:Icon}) => <button key={id} className="feature-item" onClick={() => { onClose(); if(id === "payload") openPayload(); else nav(id); }}><span className="feature-icon"><Icon size={16}/></span><span><b>{title}</b><small>{desc}</small></span><ArrowRight size={14}/></button>)}</div></div></div>; }

function PhotoCard({ station, code }) { const [failed, setFailed] = useState(false); const onMove = e => { const r=e.currentTarget.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*100; const y=(e.clientY-r.top)/r.height*100; e.currentTarget.style.setProperty("--rx",`${(50-y)/12}deg`); e.currentTarget.style.setProperty("--ry",`${(x-50)/12}deg`); e.currentTarget.style.setProperty("--mx",`${x}%`); e.currentTarget.style.setProperty("--my",`${y}%`); }; const reset=e=>{e.currentTarget.style.setProperty("--rx","0deg");e.currentTarget.style.setProperty("--ry","0deg");}; return <article className="photo-card-3d" onMouseMove={onMove} onMouseLeave={reset}><div className="photo-depth-layer layer-back"/><div className="photo-depth-layer layer-mid"/><div className={`photo-surface ${failed?"image-failed":""}`}><img src={station.image} alt={`${station.name} Antarctic research station`} onError={e=>{if(e.currentTarget.dataset.fallback!=="1"){e.currentTarget.dataset.fallback="1";e.currentTarget.src=station.fallback;}else setFailed(true);}}/><div className="photo-fallback"><Snowflake size={22}/><span>FIELD IMAGE UNAVAILABLE</span><small>Local fallback active</small></div><div className="photo-glare"/><div className="photo-scan"/><div className="photo-hud"><b>{code}</b><span>REAL FIELD IMAGE / NCPOR</span></div><div className="photo-overlay"><span>{station.coords}</span><b>{station.name}</b><small>ANTARCTIC RESEARCH STATION</small></div></div></article>; }

export default App;
