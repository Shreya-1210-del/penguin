// PolarScore.jsx — Circular Gauge & Environmental Severity Indicator
// Indian Antarctic Research Stations (Bharati & Maitri)

import React, { useMemo } from "react";
import { Shield, AlertTriangle, Snowflake, Wind, Gauge, Droplets, Thermometer } from "lucide-react";
import { calculatePolarScore, getPolarScoreFromWeather } from "./polarScoreUtils.js";

/**
 * PolarScore Component
 *
 * Renders a tactical circular gauge visualization representing the 0-100 Polar Condition Score.
 *
 * @param {object} props
 * @param {object} [props.weather] - Normalized weather object from weatherService / useWeather
 * @param {number} [props.temperature] - Temperature in °C
 * @param {number} [props.windSpeed] - Wind speed in km/h
 * @param {number} [props.humidity] - Relative humidity in %
 * @param {number} [props.pressure] - Surface pressure in hPa
 * @param {number} [props.size=86] - Circular gauge diameter in pixels
 * @param {boolean} [props.showBreakdown=true] - Display subcomponent breakdown
 */
export function PolarScore({
  weather,
  temperature,
  windSpeed,
  humidity,
  pressure,
  size = 84,
  strokeWidth = 6.5,
  showBreakdown = true,
}) {
  // Calculate polar condition score from either weather object or individual inputs
  const result = useMemo(() => {
    if (weather) {
      return getPolarScoreFromWeather(weather);
    }
    return calculatePolarScore({
      temperature,
      windSpeed,
      humidity,
      pressure,
    });
  }, [weather, temperature, windSpeed, humidity, pressure]);

  const { score, status, tone, color, components } = result;

  // Circular gauge geometry
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Progress offset (0% = circumference, 100% = 0)
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className={`polar-score-card tone-${tone}`}>
      <div className="polar-gauge-cluster">
        {/* SVG Circular Gauge */}
        <div className="polar-svg-wrap" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="polar-gauge-svg">
            <defs>
              <filter id={`gauge-glow-${tone}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Track Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className="polar-gauge-track"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Dynamic Score Meter Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className={`polar-gauge-meter ${tone}`}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              filter={`url(#gauge-glow-${tone})`}
            />

            {/* Center Numeric Readout */}
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="polar-gauge-number"
            >
              {score}
            </text>
            <text
              x="50%"
              y="68%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="polar-gauge-sub"
            >
              / 100
            </text>
          </svg>
        </div>

        {/* Status & Tactical Title */}
        <div className="polar-summary">
          <div className="polar-kicker">
            <Shield size={12} className="polar-icon-kicker" />
            <span>POLAR CONDITION SCORE</span>
          </div>
          <div className="polar-status-line">
            <span className={`polar-status-badge ${tone}`}>
              <i className="polar-live-dot" />
              {status.toUpperCase()}
            </span>
          </div>
          <p className="polar-status-desc">
            {tone === "optimal" && "Optimal polar operations envelope. Minimal risk to personnel & generation."}
            {tone === "stable" && "Nominal Antarctic baseline conditions. Standard logistics active."}
            {tone === "warning" && "Elevated cold/wind stress. Monitor fuel viscosity & outdoor sorties."}
            {tone === "high-risk" && "Severe environmental degradation. Blizzard front or wind chill alert."}
            {tone === "critical" && "Emergency conditions. Shelter-in-place protocol & maximum thermal burn."}
          </p>
        </div>
      </div>

      {/* Subcomponent Breakdown (4 Inputs) */}
      {showBreakdown && components && (
        <div className="polar-breakdown-grid">
          <div className="polar-factor-cell">
            <span className="factor-label">
              <Thermometer size={10} /> TEMP (40%)
            </span>
            <div className="factor-bar">
              <div
                className={`factor-bar-fill ${tone}`}
                style={{ width: `${components.temperature.score}%` }}
              />
            </div>
            <div className="factor-meta">
              <b>{components.temperature.value.toFixed(1)}°C</b>
              <small>{components.temperature.score} pts</small>
            </div>
          </div>

          <div className="polar-factor-cell">
            <span className="factor-label">
              <Wind size={10} /> WIND (30%)
            </span>
            <div className="factor-bar">
              <div
                className={`factor-bar-fill ${tone}`}
                style={{ width: `${components.windSpeed.score}%` }}
              />
            </div>
            <div className="factor-meta">
              <b>{components.windSpeed.value.toFixed(1)} km/h</b>
              <small>{components.windSpeed.score} pts</small>
            </div>
          </div>

          <div className="polar-factor-cell">
            <span className="factor-label">
              <Gauge size={10} /> PRESS (20%)
            </span>
            <div className="factor-bar">
              <div
                className={`factor-bar-fill ${tone}`}
                style={{ width: `${components.pressure.score}%` }}
              />
            </div>
            <div className="factor-meta">
              <b>{components.pressure.value.toFixed(0)} hPa</b>
              <small>{components.pressure.score} pts</small>
            </div>
          </div>

          <div className="polar-factor-cell">
            <span className="factor-label">
              <Droplets size={10} /> HUMID (10%)
            </span>
            <div className="factor-bar">
              <div
                className={`factor-bar-fill ${tone}`}
                style={{ width: `${components.humidity.score}%` }}
              />
            </div>
            <div className="factor-meta">
              <b>{components.humidity.value}%</b>
              <small>{components.humidity.score} pts</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PolarScore;
