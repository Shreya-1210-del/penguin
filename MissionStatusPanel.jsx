// MissionStatusPanel.jsx — Weather Impact & Mission Status Panel
// Connects real-time meteorological conditions to station operations:
// Power Demand, Communication Reliability, Equipment Stress, Outdoor Operation Availability.
// Displays statuses: NORMAL, WATCH, WARNING, CRITICAL.

import React, { useMemo } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Compass,
  Cpu,
  Gauge,
  Radio,
  Shield,
  ShieldAlert,
  Thermometer,
  Wifi,
  Wind,
  Zap,
} from "lucide-react";
import {
  evaluateWeatherImpacts,
  IMPACT_STATUS,
  IMPACT_COLORS,
} from "./services/weatherImpactEngine.js";

/**
 * MissionStatusPanel Component
 *
 * Visualizes the operational impacts of real-time Antarctic weather:
 * - Power Demand
 * - Communication Reliability
 * - Equipment Stress
 * - Outdoor Operation Availability
 *
 * Statuses: NORMAL, WATCH, WARNING, CRITICAL.
 * Fully integrated with Risk Engine and Weather Event Engine.
 *
 * @param {object} props
 * @param {object} props.weather - Current normalized weather object
 * @param {object} [props.engine] - Digital twin simulation telemetry engine
 * @param {string} [props.stationName] - Station name
 */
export function MissionStatusPanel({ weather, engine, stationName = "Antarctic Station" }) {
  const impacts = useMemo(() => evaluateWeatherImpacts(weather), [weather]);

  const {
    powerDemand,
    communicationReliability,
    equipmentStress,
    outdoorOperationAvailability,
    overallStatus,
    color,
    riskAssessment,
    activeEvents,
    activeEventsCount,
  } = impacts;

  const getToneClass = (status) => {
    switch (status) {
      case IMPACT_STATUS.CRITICAL:
        return "critical";
      case IMPACT_STATUS.WARNING:
        return "warning";
      case IMPACT_STATUS.WATCH:
        return "watch";
      case IMPACT_STATUS.NORMAL:
      default:
        return "normal";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case IMPACT_STATUS.CRITICAL:
        return <AlertOctagon size={14} className="impact-status-icon critical" />;
      case IMPACT_STATUS.WARNING:
        return <AlertTriangle size={14} className="impact-status-icon warning" />;
      case IMPACT_STATUS.WATCH:
        return <Activity size={14} className="impact-status-icon watch" />;
      case IMPACT_STATUS.NORMAL:
      default:
        return <CheckCircle2 size={14} className="impact-status-icon normal" />;
    }
  };

  return (
    <section className="panel mission-status-panel" id="mission-status">
      {/* Panel Header */}
      <div className="panel-head">
        <div>
          <span className="eyebrow">CENTRAL COMMAND / MISSION IMPACT ENGINE</span>
          <h2>Mission Status Panel</h2>
        </div>
        <div className="mission-head-status">
          <span className={`mission-overall-badge tone-${getToneClass(overallStatus)}`}>
            <i className="mission-live-beacon" />
            MISSION STATUS: <b>{overallStatus}</b>
          </span>
          <ShieldAlert size={18} className={`mission-head-icon tone-${getToneClass(overallStatus)}`} />
        </div>
      </div>

      {/* Atmospheric Context Kicker */}
      <div className="mission-context-strip">
        <div className="mission-station-tag">
          <Compass size={13} />
          <span>{stationName}</span>
        </div>
        <div className="mission-events-tag">
          <Zap size={13} />
          <span>
            {activeEventsCount > 0
              ? `${activeEventsCount} Weather Event${activeEventsCount > 1 ? "s" : ""} Active`
              : "No Weather Anomalies"}
          </span>
        </div>
        <div className="mission-risk-tag">
          <Shield size={13} />
          <span>Risk Engine: <b>{riskAssessment?.overallRiskLevel || "NOMINAL"}</b></span>
        </div>
      </div>

      {/* 4 Core Weather Impacts Grid */}
      <div className="impacts-grid">
        {/* 1. Power Demand */}
        <div className={`impact-card tone-${getToneClass(powerDemand.status)}`}>
          <div className="impact-card-top">
            <div className="impact-title-wrap">
              <Zap size={15} className="impact-icon zap-icon" />
              <div>
                <b>POWER DEMAND</b>
                <small>Heating & Trace Load</small>
              </div>
            </div>
            <span className={`impact-badge tone-${getToneClass(powerDemand.status)}`}>
              {getStatusIcon(powerDemand.status)}
              {powerDemand.status}
            </span>
          </div>

          <div className="impact-metric-row">
            <span className="impact-big-value">{powerDemand.value}</span>
            <span className="impact-subtext">{powerDemand.subtext}</span>
          </div>

          {/* Meter progress bar */}
          <div className="impact-meter-track">
            <div
              className={`impact-meter-fill tone-${getToneClass(powerDemand.status)}`}
              style={{ width: `${Math.min(100, Math.max(15, (powerDemand.metricValue / 110) * 100))}%` }}
            />
          </div>

          <p className="impact-advisory">{powerDemand.advisory}</p>

          <div className="impact-factors-wrap">
            {powerDemand.factors.slice(0, 2).map((factor, idx) => (
              <span key={idx} className="impact-factor-item">
                • {factor}
              </span>
            ))}
          </div>
        </div>

        {/* 2. Communication Reliability */}
        <div className={`impact-card tone-${getToneClass(communicationReliability.status)}`}>
          <div className="impact-card-top">
            <div className="impact-title-wrap">
              <Radio size={15} className="impact-icon radio-icon" />
              <div>
                <b>COMMUNICATION RELIABILITY</b>
                <small>SATCOM & Antenna Alignment</small>
              </div>
            </div>
            <span className={`impact-badge tone-${getToneClass(communicationReliability.status)}`}>
              {getStatusIcon(communicationReliability.status)}
              {communicationReliability.status}
            </span>
          </div>

          <div className="impact-metric-row">
            <span className="impact-big-value">{communicationReliability.value}</span>
            <span className="impact-subtext">{communicationReliability.subtext}</span>
          </div>

          <div className="impact-meter-track">
            <div
              className={`impact-meter-fill tone-${getToneClass(communicationReliability.status)}`}
              style={{ width: `${communicationReliability.metricValue}%` }}
            />
          </div>

          <p className="impact-advisory">{communicationReliability.advisory}</p>

          <div className="impact-factors-wrap">
            {communicationReliability.factors.slice(0, 2).map((factor, idx) => (
              <span key={idx} className="impact-factor-item">
                • {factor}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Equipment Stress */}
        <div className={`impact-card tone-${getToneClass(equipmentStress.status)}`}>
          <div className="impact-card-top">
            <div className="impact-title-wrap">
              <Cpu size={15} className="impact-icon cpu-icon" />
              <div>
                <b>EQUIPMENT STRESS</b>
                <small>Viscosity, Vibration & Icing</small>
              </div>
            </div>
            <span className={`impact-badge tone-${getToneClass(equipmentStress.status)}`}>
              {getStatusIcon(equipmentStress.status)}
              {equipmentStress.status}
            </span>
          </div>

          <div className="impact-metric-row">
            <span className="impact-big-value">{equipmentStress.value}</span>
            <span className="impact-subtext">{equipmentStress.subtext}</span>
          </div>

          <div className="impact-meter-track">
            <div
              className={`impact-meter-fill tone-${getToneClass(equipmentStress.status)}`}
              style={{ width: `${equipmentStress.metricValue}%` }}
            />
          </div>

          <p className="impact-advisory">{equipmentStress.advisory}</p>

          <div className="impact-factors-wrap">
            {equipmentStress.factors.slice(0, 2).map((factor, idx) => (
              <span key={idx} className="impact-factor-item">
                • {factor}
              </span>
            ))}
          </div>
        </div>

        {/* 4. Outdoor Operation Availability */}
        <div className={`impact-card tone-${getToneClass(outdoorOperationAvailability.status)}`}>
          <div className="impact-card-top">
            <div className="impact-title-wrap">
              <Compass size={15} className="impact-icon compass-icon" />
              <div>
                <b>OUTDOOR AVAILABILITY</b>
                <small>Traverse & Sortie Envelope</small>
              </div>
            </div>
            <span className={`impact-badge tone-${getToneClass(outdoorOperationAvailability.status)}`}>
              {getStatusIcon(outdoorOperationAvailability.status)}
              {outdoorOperationAvailability.status}
            </span>
          </div>

          <div className="impact-metric-row">
            <span className="impact-big-value">{outdoorOperationAvailability.value}</span>
            <span className="impact-subtext">{outdoorOperationAvailability.subtext}</span>
          </div>

          <div className="impact-meter-track">
            <div
              className={`impact-meter-fill tone-${getToneClass(outdoorOperationAvailability.status)}`}
              style={{ width: `${outdoorOperationAvailability.metricValue}%` }}
            />
          </div>

          <p className="impact-advisory">{outdoorOperationAvailability.advisory}</p>

          <div className="impact-factors-wrap">
            {outdoorOperationAvailability.factors.slice(0, 2).map((factor, idx) => (
              <span key={idx} className="impact-factor-item">
                • {factor}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Engine Telemetry Integration Strip */}
      {engine && (
        <div className="mission-telemetry-kpis">
          <div className="mission-kpi-cell">
            <span>ACTIVE GEN</span>
            <b>{engine.activeGenerators}/3 Units</b>
          </div>
          <div className="mission-kpi-cell">
            <span>GEN BAY</span>
            <b className={engine.generatorStatus === "CRITICAL" ? "text-red" : "text-green"}>
              {engine.generatorStatus}
            </b>
          </div>
          <div className="mission-kpi-cell">
            <span>EFFICIENCY</span>
            <b>{engine.efficiencyIndex?.toFixed(1) || 94.2}%</b>
          </div>
          <div className="mission-kpi-cell">
            <span>FUEL RESERVE</span>
            <b className={engine.survivalDays < 15 ? "text-red" : "text-amber"}>
              {engine.survivalDays?.toFixed(1) || "120"} Days
            </b>
          </div>
        </div>
      )}
    </section>
  );
}

export default MissionStatusPanel;
