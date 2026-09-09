// MissionOpsCenter.jsx — Antarctic Mission Operations Center
// Full-width operational intelligence console replacing the Feature Control section.
// LEFT PANEL: Mission Status Panel (Overall Mission Status, Operational/Personnel/Equipment Risk, Active Alerts Count, Active Events Feed, Current Station Status, System Health Summary)
// RIGHT PANEL: Weather Intelligence Panel (Current Temp, Feels Like, Wind Speed/Direction, Humidity, Pressure, Weather Condition, Last Updated Timestamp, Polar Condition Score, Weather Impact Matrix)

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  CloudSun,
  Compass,
  Cpu,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Users,
  Wind,
  Zap,
} from "lucide-react";
import {
  evaluateWeatherImpacts,
  IMPACT_STATUS,
} from "./services/weatherImpactEngine.js";
import { RISK_LEVELS } from "./services/riskEngine.js";
import { detectWeatherEvents, getInitialHistoricalEvents } from "./weatherEvents.js";
import PolarScore from "./PolarScore.jsx";

// ── Status Helpers ──

function getImpactTone(status) {
  switch (status) {
    case IMPACT_STATUS.CRITICAL: return "critical";
    case IMPACT_STATUS.WARNING: return "warning";
    case IMPACT_STATUS.WATCH: return "watch";
    default: return "normal";
  }
}

function getRiskTone(level) {
  switch (level) {
    case RISK_LEVELS.CRITICAL: return "critical";
    case RISK_LEVELS.HIGH: return "high";
    case RISK_LEVELS.MEDIUM: return "medium";
    default: return "low";
  }
}

function StatusIcon({ status, size = 12 }) {
  switch (status) {
    case "CRITICAL": return <AlertOctagon size={size} />;
    case "WARNING": case "HIGH": return <AlertTriangle size={size} />;
    case "WATCH": case "MEDIUM": return <Activity size={size} />;
    default: return <CheckCircle2 size={size} />;
  }
}

function formatEventTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "--:--";
  }
}

// ── Main Component ──

export function MissionOpsCenter({ weather, engine, stationName = "Antarctic Station", weatherState }) {
  const { loading, isRefreshing, error, refetch, lastUpdated } = weatherState || {};

  // 1. Weather Impact Engine (synthesizes risks, active weather events, operational outputs)
  const impacts = useMemo(() => evaluateWeatherImpacts(weather), [weather]);
  const {
    powerDemand,
    communicationReliability,
    equipmentStress,
    outdoorOperationAvailability,
    overallStatus,
    riskAssessment,
    activeEvents: weatherActiveEvents,
  } = impacts;

  // 2. Risk Events generated from Risk Engine vectors
  const riskEvents = useMemo(() => {
    if (!riskAssessment) return [];
    const events = [];
    const stationId = weather?.stationId || "BHARATI";
    const now = new Date().toISOString();

    if (riskAssessment.operational?.level === "CRITICAL" || riskAssessment.operational?.level === "HIGH") {
      events.push({
        id: `risk-op-${stationId}-${riskAssessment.operational.level}`,
        type: "RISK",
        category: "OPERATIONAL",
        severity: riskAssessment.operational.level,
        station: stationId,
        timestamp: now,
        title: `Operational Risk: ${riskAssessment.operational.level}`,
        description: riskAssessment.operational.advisory || "Elevated operational risk across exterior station operations.",
      });
    }

    if (riskAssessment.personnel?.level === "CRITICAL" || riskAssessment.personnel?.level === "HIGH") {
      events.push({
        id: `risk-pers-${stationId}-${riskAssessment.personnel.level}`,
        type: "RISK",
        category: "PERSONNEL",
        severity: riskAssessment.personnel.level,
        station: stationId,
        timestamp: now,
        title: `Personnel Hazard: ${riskAssessment.personnel.level}`,
        description: riskAssessment.personnel.advisory || "Severe wind chill / frostbite exposure limit advisory in effect.",
      });
    }

    if (riskAssessment.equipment?.level === "CRITICAL" || riskAssessment.equipment?.level === "HIGH") {
      events.push({
        id: `risk-equip-${stationId}-${riskAssessment.equipment.level}`,
        type: "RISK",
        category: "EQUIPMENT",
        severity: riskAssessment.equipment.level,
        station: stationId,
        timestamp: now,
        title: `Equipment Stress: ${riskAssessment.equipment.level}`,
        description: riskAssessment.equipment.advisory || "Elevated mechanical stress and fuel viscosity thickening alert.",
      });
    }

    return events;
  }, [riskAssessment, weather?.stationId]);

  // 3. Station Events generated from engine telemetry state
  const stationEvents = useMemo(() => {
    if (!engine) return [];
    const events = [];
    const stationId = weather?.stationId || "BHARATI";
    const now = new Date().toISOString();

    if (engine.generatorStatus === "CRITICAL") {
      events.push({
        id: "stn-gen-crit",
        type: "STATION",
        category: "GENERATOR",
        severity: "CRITICAL",
        station: stationId,
        timestamp: now,
        title: "Generator Bay Critical",
        description: "Primary generator failure simulation active. Secondary spin-up required immediately.",
      });
    }
    if (engine.ambientTemp < -35) {
      events.push({
        id: "stn-cold-warn",
        type: "STATION",
        category: "THERMAL",
        severity: "WARNING",
        station: stationId,
        timestamp: now,
        title: "Extreme Ambient Chill",
        description: `Ambient temperature ${engine.ambientTemp.toFixed(1)}°C exceeds baseline operational envelope.`,
      });
    }
    if (engine.survivalDays < 15) {
      events.push({
        id: "stn-fuel-crit",
        type: "STATION",
        category: "FUEL",
        severity: "CRITICAL",
        station: stationId,
        timestamp: now,
        title: "Fuel Reserve Critical",
        description: `Station endurance at ${engine.survivalDays.toFixed(1)} days. Emergency resupply corridor required.`,
      });
    }
    if (engine.viscosityRisk) {
      events.push({
        id: "stn-visc-warn",
        type: "STATION",
        category: "LOGISTICS",
        severity: "WARNING",
        station: stationId,
        timestamp: now,
        title: "Fuel Viscosity Warning",
        description: "Diesel viscosity thickening detected. Auxiliary line trace heating active.",
      });
    }
    return events;
  }, [engine?.generatorStatus, engine?.ambientTemp, engine?.survivalDays, engine?.viscosityRisk, weather?.stationId]);

  // 4. Combined Event Feed (Weather Events + Risk Events + Station Events, newest first)
  const allEvents = useMemo(() => {
    const historical = getInitialHistoricalEvents();
    const liveDetected = weather ? detectWeatherEvents(weather) : [];
    const weatherPool = [...liveDetected, ...historical];

    const combined = [...weatherPool, ...riskEvents, ...stationEvents];
    // Deduplicate by id
    const seen = new Set();
    const deduped = [];
    for (const evt of combined) {
      if (evt && evt.id && !seen.has(evt.id)) {
        seen.add(evt.id);
        deduped.push(evt);
      }
    }
    // Sort newest first
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deduped;
  }, [weather, riskEvents, stationEvents]);

  // Active Alerts Count (CRITICAL + WARNING)
  const activeAlertsCount = useMemo(() => {
    return allEvents.filter(e => e.severity === "CRITICAL" || e.severity === "WARNING").length;
  }, [allEvents]);

  // Event feed category filter
  const [eventFilter, setEventFilter] = useState("ALL");
  const filteredEvents = useMemo(() => {
    if (eventFilter === "ALL") return allEvents;
    if (eventFilter === "CRITICAL") return allEvents.filter(e => e.severity === "CRITICAL");
    if (eventFilter === "WARNING") return allEvents.filter(e => e.severity === "WARNING");
    if (eventFilter === "WEATHER") return allEvents.filter(e => e.type !== "RISK" && e.type !== "STATION");
    if (eventFilter === "RISK") return allEvents.filter(e => e.type === "RISK");
    if (eventFilter === "STATION") return allEvents.filter(e => e.type === "STATION");
    return allEvents;
  }, [allEvents, eventFilter]);

  // Risk vectors for display
  const riskVectors = riskAssessment ? [
    { key: "operational", label: "OPERATIONAL RISK", icon: Radio, ...riskAssessment.operational },
    { key: "personnel", label: "PERSONNEL RISK", icon: Users, ...riskAssessment.personnel },
    { key: "equipment", label: "EQUIPMENT RISK", icon: Cpu, ...riskAssessment.equipment },
  ] : [];

  // Weather Impact vectors for display
  const impactVectors = [
    { key: "power", label: "POWER DEMAND", icon: Zap, ...powerDemand },
    { key: "comms", label: "COMMS RELIABILITY", icon: Radio, ...communicationReliability },
    { key: "equip-stress", label: "EQUIPMENT STRESS", icon: Cpu, ...equipmentStress },
    { key: "outdoor", label: "OUTDOOR OPS", icon: Compass, ...outdoorOperationAvailability },
  ];

  // System health summary items
  const systemHealthItems = engine ? [
    { label: "Generator Bay", value: engine.generatorStatus, tone: engine.generatorStatus === "CRITICAL" ? "critical" : "ok" },
    { label: "Fuel Storage", value: engine.ambientTemp < -35 ? "WARNING" : "NORMAL", tone: engine.ambientTemp < -35 ? "warning" : "ok" },
    { label: "Living Quarters", value: "NORMAL", tone: "ok" },
    { label: "Blizzard Protocol", value: engine.ambientTemp < -35 ? "ACTIVE" : "STANDBY", tone: engine.ambientTemp < -35 ? "warning" : "ok" },
    { label: "Viscosity Risk", value: engine.viscosityRisk ? "WARNING" : "NORMAL", tone: engine.viscosityRisk ? "warning" : "ok" },
  ] : [];

  return (
    <section className="ops-center" id="ops-center">
      {/* ── Section Title & Tactical Header ── */}
      <div className="ops-center-header">
        <div>
          <span className="eyebrow">PENGUIN / MISSION OPERATIONS CENTER</span>
          <h2>Antarctic Mission Control & Operational Intelligence</h2>
          <p>Continuous polar telemetry and meteorological risk synthesis for India&apos;s research stations (Bharati &amp; Maitri).</p>
        </div>
        <div className="ops-header-badges">
          <span className={`ops-mission-badge tone-${getImpactTone(overallStatus)}`}>
            <i className="ops-beacon" />
            MISSION STATUS: <b>{overallStatus}</b>
          </span>
          <span className={`ops-risk-badge tone-${getRiskTone(riskAssessment?.overallRiskLevel || "LOW")}`}>
            <ShieldAlert size={13} />
            THREAT: <b>{riskAssessment?.overallRiskLevel || "LOW"}</b>
          </span>
        </div>
      </div>

      {/* ── Dual Panel Command Layout ── */}
      <div className="ops-grid">

        {/* ════════════════════════════════════════════════════════════════════
             LEFT PANEL: MISSION STATUS PANEL
             Displays:
             - Overall Mission Status
             - Operational Risk
             - Personnel Risk
             - Equipment Risk
             - Active Alerts Count
             - Active Events Feed
             - Current Station Status
             - System Health Summary
             ════════════════════════════════════════════════════════════════════ */}
        <div className="ops-left">
          <div className="ops-panel-banner">
            <span className="ops-panel-kicker">COMMAND SYSTEM // PRIMARY OPS</span>
            <div className="ops-panel-title-row">
              <h3>Mission Status Panel</h3>
              <span className={`ops-station-pill tone-${getImpactTone(overallStatus)}`}>
                <StatusIcon status={overallStatus} size={11} />
                {stationName.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 1. Overall Mission Status & Station Status Card */}
          <div className="ops-card ops-overall-card">
            <div className="ops-card-head">
              <ShieldAlert size={15} className={`ops-icon tone-${getImpactTone(overallStatus)}`} />
              <b>OVERALL MISSION STATUS</b>
              <span className="ops-alert-count-pill">
                <Bell size={11} />
                {activeAlertsCount} ACTIVE ALERT{activeAlertsCount !== 1 ? "S" : ""}
              </span>
            </div>
            <div className={`ops-overall-value tone-${getImpactTone(overallStatus)}`}>
              <StatusIcon status={overallStatus} size={24} />
              <span>{overallStatus}</span>
            </div>
            <div className="ops-overall-meta">
              <span><Compass size={11} /> <b>Station:</b> {stationName}</span>
              <span><Radio size={11} /> <b>Link:</b> {engine?.isSatSyncMode ? "SATSYNC DELTA" : "HIGH-RES TELEMETRY"}</span>
              <span><Activity size={11} /> <b>Scenario:</b> {engine?.scenario || "BASELINE"}</span>
            </div>
          </div>

          {/* 2. Operational, Personnel, and Equipment Risk Card */}
          <div className="ops-card">
            <div className="ops-card-head">
              <Shield size={14} className="ops-icon" />
              <b>POLAR RISK VECTORS (RISK ENGINE)</b>
              <span className={`ops-inline-badge tone-${getRiskTone(riskAssessment?.overallRiskLevel || "LOW")}`}>
                INDEX: {riskAssessment?.overallRiskLevel || "LOW"}
              </span>
            </div>
            <div className="ops-risk-rows">
              {riskVectors.map(rv => (
                <div key={rv.key} className={`ops-risk-row tone-${getRiskTone(rv.level)}`}>
                  <div className="ops-risk-row-left">
                    <rv.icon size={13} />
                    <span>{rv.label}</span>
                  </div>
                  <span className={`ops-risk-level tone-${getRiskTone(rv.level)}`}>{rv.level}</span>
                  <div className="ops-risk-bar-track">
                    <div
                      className={`ops-risk-bar-fill tone-${getRiskTone(rv.level)}`}
                      style={{ width: `${Math.max(8, rv.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. System Health Summary Card */}
          {systemHealthItems.length > 0 && (
            <div className="ops-card">
              <div className="ops-card-head">
                <CheckCircle2 size={14} className="ops-icon" />
                <b>SYSTEM HEALTH SUMMARY</b>
                <span className="ops-health-status-tag">
                  {engine.generatorStatus === "CRITICAL" ? "ATTENTION REQUIRED" : "NOMINAL"}
                </span>
              </div>
              <div className="ops-health-rows">
                {systemHealthItems.map(si => (
                  <div key={si.label} className="ops-health-row">
                    <span className="ops-health-label">
                      <i className={`ops-health-dot ${si.tone}`} />
                      {si.label}
                    </span>
                    <b className={`ops-health-val ${si.tone}`}>{si.value}</b>
                  </div>
                ))}
              </div>
              {engine && (
                <div className="ops-health-kpis">
                  <div><span>GENERATORS</span><b>{engine.activeGenerators} / 3 ACTIVE</b></div>
                  <div><span>POWER LOAD</span><b>{engine.powerLoadKW.toFixed(0)} kW</b></div>
                  <div><span>BURN RATE</span><b>{engine.actualBurnRate.toFixed(1)} L/h</b></div>
                  <div><span>SURVIVAL</span><b className={engine.survivalDays < 15 ? "text-red" : ""}>{engine.survivalDays.toFixed(1)} DAYS</b></div>
                </div>
              )}
            </div>
          )}

          {/* 4. Active Events Feed Card (Weather + Risk + Station Events, newest first) */}
          <div className="ops-card ops-events-card">
            <div className="ops-card-head">
              <Bell size={14} className="ops-icon" />
              <b>ACTIVE EVENTS FEED</b>
              <span className="ops-event-count">{allEvents.length} TOTAL</span>
            </div>

            <div className="ops-event-filters">
              {["ALL", "CRITICAL", "WARNING", "WEATHER", "RISK", "STATION"].map(f => {
                let count = allEvents.length;
                if (f === "CRITICAL") count = allEvents.filter(e => e.severity === "CRITICAL").length;
                else if (f === "WARNING") count = allEvents.filter(e => e.severity === "WARNING").length;
                else if (f === "WEATHER") count = allEvents.filter(e => e.type !== "RISK" && e.type !== "STATION").length;
                else if (f === "RISK") count = allEvents.filter(e => e.type === "RISK").length;
                else if (f === "STATION") count = allEvents.filter(e => e.type === "STATION").length;

                return (
                  <button
                    key={f}
                    className={`ops-event-filter ${eventFilter === f ? "active" : ""}`}
                    onClick={() => setEventFilter(f)}
                  >
                    {f} <span className="filter-badge">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="ops-event-list">
              {filteredEvents.length === 0 ? (
                <div className="ops-event-empty">
                  <CheckCircle2 size={16} />
                  <span>No events match active filter — all systems nominal</span>
                </div>
              ) : (
                filteredEvents.map((evt, idx) => (
                  <div key={evt.id || idx} className={`ops-event-row severity-${evt.severity?.toLowerCase() || "info"}`}>
                    <div className="ops-event-head">
                      <div className="ops-event-tags">
                        <span className={`ops-event-sev ${evt.severity?.toLowerCase()}`}>
                          <StatusIcon status={evt.severity} size={10} />
                          {evt.severity}
                        </span>
                        <span className="ops-event-cat-tag">{evt.type || "EVENT"}</span>
                      </div>
                      <time><Clock size={10} /> {formatEventTime(evt.timestamp)}</time>
                    </div>
                    <b className="ops-event-title">{evt.title || evt.type}</b>
                    <p className="ops-event-desc">{evt.description}</p>
                    <div className="ops-event-footer-meta">
                      {evt.station && <span className="ops-event-station"><Compass size={10} /> {evt.station}</span>}
                      {evt.metric && <span className="ops-event-metric">{evt.metric}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
             RIGHT PANEL: WEATHER INTELLIGENCE PANEL
             Displays:
             - Current Temperature
             - Feels Like Temperature
             - Wind Speed
             - Wind Direction
             - Humidity
             - Pressure
             - Weather Condition
             - Last Updated Timestamp
             - Polar Condition Score
             - Weather Impact Matrix (Power Demand, Comms, Equip Stress, Outdoor Ops)
             ════════════════════════════════════════════════════════════════════ */}
        <div className="ops-right">
          <div className="ops-panel-banner">
            <span className="ops-panel-kicker">METEOROLOGICAL TELEMETRY // REAL-TIME GRID</span>
            <div className="ops-panel-title-row">
              <h3>Weather Intelligence Panel</h3>
              <div className="ops-weather-sync-ctrls">
                <span className="ops-weather-sync">
                  <span className={`ops-sync-dot ${isRefreshing ? "refreshing" : "live"}`} />
                  {isRefreshing ? "SYNCING" : "LIVE OPEN-METEO"}
                </span>
                {refetch && (
                  <button
                    className="ops-refresh-btn"
                    onClick={() => refetch()}
                    disabled={loading || isRefreshing}
                    title="Manual weather sync"
                  >
                    <RefreshCw size={11} className={isRefreshing ? "spinning" : ""} />
                    <span>REFRESH</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 1. Polar Condition Score (Circular Gauge Visualization & Factors) */}
          <div className="ops-card ops-polar-card">
            <div className="ops-card-head">
              <Shield size={14} className="ops-icon" />
              <b>POLAR CONDITION SCORE (0 - 100 GAUGE)</b>
            </div>
            {weather ? (
              <PolarScore weather={weather} size={88} showBreakdown={true} />
            ) : loading ? (
              <div className="ops-wx-loading">
                <RefreshCw size={14} className="spinning" />
                <span>CALCULATING POLAR CONDITION SCORE...</span>
              </div>
            ) : (
              <div className="ops-wx-loading">
                <AlertTriangle size={14} />
                <span>Polar Score unavailable (Awaiting weather connection)</span>
              </div>
            )}
          </div>

          {/* 2. Meteorological Readings Grid */}
          <div className="ops-card ops-weather-card">
            <div className="ops-card-head">
              <CloudSun size={14} className="ops-icon weather-icon" />
              <b>METEOROLOGICAL READINGS</b>
              {weather?.isFallback && (
                <span className="ops-fallback-tag">OFFLINE FALLBACK</span>
              )}
            </div>

            {weather ? (
              <>
                <div className="ops-weather-grid">
                  {/* Current Temperature & Feels Like */}
                  <div className="ops-wx-cell">
                    <span className="ops-wx-label"><Thermometer size={11} /> AIR TEMPERATURE</span>
                    <b className="ops-wx-val">{weather.temperature?.toFixed(1)}°C</b>
                    <small>FEELS LIKE <b>{weather.apparentTemperature?.toFixed(1)}°C</b> (WIND CHILL)</small>
                  </div>

                  {/* Wind Speed & Direction */}
                  <div className="ops-wx-cell">
                    <span className="ops-wx-label"><Wind size={11} /> SURFACE WIND</span>
                    <b className="ops-wx-val">{weather.windSpeedKmH?.toFixed(1)} km/h</b>
                    <small>DIRECTION <b>{weather.windDirectionCompass}</b> ({weather.windDirectionDeg}°)</small>
                  </div>

                  {/* Barometric Pressure & Humidity */}
                  <div className="ops-wx-cell">
                    <span className="ops-wx-label"><Compass size={11} /> BAROMETRIC PRESSURE</span>
                    <b className="ops-wx-val">{weather.surfacePressureHPa?.toFixed(0)} hPa</b>
                    <small>RELATIVE HUMIDITY <b>{weather.relativeHumidity}%</b></small>
                  </div>

                  {/* Weather Condition */}
                  <div className="ops-wx-cell">
                    <span className="ops-wx-label"><Snowflake size={11} /> WEATHER CONDITION</span>
                    <b className="ops-wx-val ops-wx-cond">{weather.weatherCondition}</b>
                    <small>WMO CODE <b>#{weather.weatherCode}</b> ({weather.isFallback ? "FALLBACK" : "OPEN-METEO"})</small>
                  </div>
                </div>

                {/* Last Updated & Coordinates */}
                <div className="ops-wx-footer">
                  <span>
                    <Clock size={10} /> LAST UPDATED: <b>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--:--"}</b>
                  </span>
                  <span>
                    <Compass size={10} /> COORDS: <b>{weather.coordinates?.latitude?.toFixed(4)}° S, {weather.coordinates?.longitude?.toFixed(4)}° E</b> (ELEV: {weather.elevationM} m)
                  </span>
                </div>
              </>
            ) : loading ? (
              <div className="ops-wx-loading">
                <RefreshCw size={14} className="spinning" />
                <span>CONNECTING TO OPEN-METEO POLAR SENSORS...</span>
              </div>
            ) : error ? (
              <div className="ops-wx-loading text-red">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          {/* 3. Station Operational Impacts (Weather Impact Engine) */}
          <div className="ops-card ops-impact-card">
            <div className="ops-card-head">
              <Activity size={14} className="ops-icon" />
              <b>WEATHER IMPACT MATRIX (OPERATIONS ENGINE)</b>
              <span className={`ops-impact-overall-tag tone-${getImpactTone(overallStatus)}`}>
                {overallStatus}
              </span>
            </div>
            <div className="ops-impact-grid">
              {impactVectors.map(iv => (
                <div key={iv.key} className={`ops-impact-cell tone-${getImpactTone(iv.status)}`}>
                  <div className="ops-impact-cell-top">
                    <iv.icon size={12} />
                    <span className="ops-impact-label">{iv.label}</span>
                    <span className={`ops-impact-status-tag tone-${getImpactTone(iv.status)}`}>{iv.status}</span>
                  </div>
                  <b className="ops-impact-val">{iv.value}</b>
                  <div className="ops-impact-bar-track">
                    <div
                      className={`ops-impact-bar-fill tone-${getImpactTone(iv.status)}`}
                      style={{
                        width: iv.id === "power-demand"
                          ? `${Math.min(100, Math.max(10, (iv.metricValue / 110) * 100))}%`
                          : `${Math.min(100, Math.max(10, iv.metricValue))}%`,
                      }}
                    />
                  </div>
                  <small className="ops-impact-sub">{iv.advisory}</small>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default MissionOpsCenter;
