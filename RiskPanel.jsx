// RiskPanel.jsx — Real-time Multi-Vector Risk Assessment Component
// Displays Operational, Personnel, and Equipment risks evaluated from live weather data

import React, { useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Cpu,
  Radio,
  Shield,
  ShieldAlert,
  Thermometer,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { assessStationRisk, RISK_LEVELS } from "./services/riskEngine.js";

/**
 * RiskPanel Component
 *
 * Renders Operational, Personnel, and Equipment risks calculated from current weather data.
 * Displays levels strictly as: LOW, MEDIUM, HIGH, CRITICAL.
 *
 * @param {object} props
 * @param {object} props.weather - Current normalized weather object
 * @param {string} [props.stationName] - Name of station
 */
export function RiskPanel({ weather, stationName = "Antarctic Station" }) {
  const assessment = useMemo(() => assessStationRisk(weather), [weather]);
  const { operational, personnel, equipment, overallRiskLevel, color } = assessment;

  const getToneClass = (level) => {
    switch (level) {
      case RISK_LEVELS.CRITICAL:
        return "critical";
      case RISK_LEVELS.HIGH:
        return "high";
      case RISK_LEVELS.MEDIUM:
        return "medium";
      default:
        return "low";
    }
  };

  const getRiskIcon = (category) => {
    switch (category) {
      case "personnel":
        return <Users size={14} className="risk-cat-icon personnel" />;
      case "equipment":
        return <Cpu size={14} className="risk-cat-icon equipment" />;
      case "operational":
      default:
        return <Radio size={14} className="risk-cat-icon operational" />;
    }
  };

  return (
    <section className="panel risk-panel" id="risk-engine">
      {/* Panel Header */}
      <div className="panel-head">
        <div>
          <span className="eyebrow">ENVIRONMENTAL DEFENSE / THREAT MATRIX</span>
          <h2>Polar Risk Engine</h2>
        </div>
        <div className="risk-head-status">
          <span className={`overall-risk-badge ${getToneClass(overallRiskLevel)}`}>
            <i className="risk-live-beacon" />
            STATION THREAT: <b>{overallRiskLevel}</b>
          </span>
          <ShieldAlert size={18} className={`risk-header-icon ${getToneClass(overallRiskLevel)}`} />
        </div>
      </div>

      <p className="risk-panel-kicker">
        Real-time physics evaluation for <b>{stationName}</b> based on live ambient chill, katabatic velocity, and barometric gradient.
      </p>

      {/* 3 Risk Vectors Grid */}
      <div className="risk-cards-grid">
        {/* 1. Operational Risk */}
        <div className={`risk-card tone-${getToneClass(operational.level)}`}>
          <div className="risk-card-header">
            <div className="risk-card-title">
              {getRiskIcon("operational")}
              <b>OPERATIONAL RISK</b>
            </div>
            <span className={`risk-level-badge ${getToneClass(operational.level)}`}>
              {operational.level}
            </span>
          </div>

          <div className="risk-meter-track">
            <div
              className={`risk-meter-fill ${getToneClass(operational.level)}`}
              style={{ width: `${operational.score}%` }}
            />
          </div>

          <p className="risk-advisory">{operational.advisory}</p>

          <div className="risk-factors-list">
            {operational.factors.map((factor, idx) => (
              <span key={idx} className="risk-factor-tag">
                • {factor}
              </span>
            ))}
          </div>
        </div>

        {/* 2. Personnel Risk */}
        <div className={`risk-card tone-${getToneClass(personnel.level)}`}>
          <div className="risk-card-header">
            <div className="risk-card-title">
              {getRiskIcon("personnel")}
              <b>PERSONNEL RISK</b>
            </div>
            <span className={`risk-level-badge ${getToneClass(personnel.level)}`}>
              {personnel.level}
            </span>
          </div>

          <div className="risk-meter-track">
            <div
              className={`risk-meter-fill ${getToneClass(personnel.level)}`}
              style={{ width: `${personnel.score}%` }}
            />
          </div>

          <p className="risk-advisory">{personnel.advisory}</p>

          <div className="risk-factors-list">
            {personnel.factors.map((factor, idx) => (
              <span key={idx} className="risk-factor-tag">
                • {factor}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Equipment Risk */}
        <div className={`risk-card tone-${getToneClass(equipment.level)}`}>
          <div className="risk-card-header">
            <div className="risk-card-title">
              {getRiskIcon("equipment")}
              <b>EQUIPMENT RISK</b>
            </div>
            <span className={`risk-level-badge ${getToneClass(equipment.level)}`}>
              {equipment.level}
            </span>
          </div>

          <div className="risk-meter-track">
            <div
              className={`risk-meter-fill ${getToneClass(equipment.level)}`}
              style={{ width: `${equipment.score}%` }}
            />
          </div>

          <p className="risk-advisory">{equipment.advisory}</p>

          <div className="risk-factors-list">
            {equipment.factors.map((factor, idx) => (
              <span key={idx} className="risk-factor-tag">
                • {factor}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Tactical Status */}
      <div className="risk-panel-footer">
        <div className="risk-footer-item">
          <span>COMPOSITE RISK INDEX:</span>
          <b style={{ color }}>{assessment.averageScore}/100</b>
        </div>
        <div className="risk-footer-item">
          <span>PRIMARY VECTOR:</span>
          <b>{overallRiskLevel === RISK_LEVELS.LOW ? "ALL NOMINAL" : "WEATHER-DRIVEN"}</b>
        </div>
        <div className="risk-footer-item">
          <span>STATION STATUS:</span>
          <b className={`status-text ${getToneClass(overallRiskLevel)}`}>
            {overallRiskLevel === RISK_LEVELS.CRITICAL ? "LOCKDOWN PROTOCOL" : overallRiskLevel === RISK_LEVELS.HIGH ? "HIGH ALERT" : overallRiskLevel === RISK_LEVELS.MEDIUM ? "ELEVATED VIGIL" : "STANDARD WATCH"}
          </b>
        </div>
      </div>
    </section>
  );
}

export default RiskPanel;
