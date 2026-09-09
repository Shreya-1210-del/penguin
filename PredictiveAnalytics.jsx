import React, { useMemo } from "react";
import {
  BrainCircuit,
  CalendarClock,
  TrendingDown,
  Fuel,
  AlertTriangle,
  Layers,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import {
  calculateRegressionTrend,
  calculateFuelForecast,
  calculateDepletionForecast,
  calculateRiskForecast,
  calculateScenarioForecast,
} from "./predictiveUtils.js";

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="pa-section-head">
      <Icon size={13} />
      <span>{title}</span>
    </div>
  );
}

export default function PredictiveAnalytics({
  history = [],
  currentFuel = 5000,
  burnRate = 62.5,
  ambientTemp = -25,
  activeScenarios = {},
  survivalDays = 80,
}) {
  // Calculations update whenever any telemetry prop changes
  const fuelForecast = useMemo(
    () => calculateFuelForecast(currentFuel, burnRate),
    [currentFuel, burnRate]
  );

  const depletion = useMemo(
    () => calculateDepletionForecast(currentFuel, burnRate),
    [currentFuel, burnRate, survivalDays]
  );

  const risk = useMemo(
    () => calculateRiskForecast(currentFuel, burnRate),
    [currentFuel, burnRate]
  );

  const scenarios = useMemo(
    () => calculateScenarioForecast(currentFuel, burnRate),
    [currentFuel, burnRate, ambientTemp, activeScenarios]
  );

  const trend = useMemo(
    () => calculateRegressionTrend(history),
    [history]
  );

  const depletionTone =
    depletion.daysRemaining < 10
      ? "danger"
      : depletion.daysRemaining < 30
      ? "warning"
      : "good";

  const fmtDays = (d) => {
    if (d === undefined || d === null || isNaN(d)) return "—";
    if (d > 999) return "999+";
    return d.toFixed(1);
  };

  const fmtFuel = (f) => {
    if (f === undefined || f === null || isNaN(f)) return "0";
    return Math.round(f).toLocaleString();
  };

  const isBlizzardActive = Boolean(activeScenarios?.blizzard);
  const isGenFailureActive = Boolean(activeScenarios?.generatorFailure);
  const isCombinedActive = isBlizzardActive && isGenFailureActive;

  return (
    <section className="panel predictive-panel" id="analytics">
      <div className="panel-head">
        <div>
          <span className="eyebrow">PREDICTIVE ANALYTICS V2</span>
          <h2>Operational forecasting</h2>
        </div>
        <BrainCircuit size={18} className="blue-icon" />
      </div>

      {/* ── SECTION 1: FUEL FORECAST ── */}
      <div className="pa-section">
        <SectionHeader icon={Fuel} title="FUEL FORECAST" />
        <div className="pa-grid pa-grid-4">
          <div className="pa-card">
            <span>Today</span>
            <b>{fmtFuel(fuelForecast.today)}</b>
            <em>L</em>
          </div>
          <div className="pa-card">
            <span>7 Days</span>
            <b>{fmtFuel(fuelForecast.day7)}</b>
            <em>L</em>
          </div>
          <div className="pa-card">
            <span>14 Days</span>
            <b>{fmtFuel(fuelForecast.day14)}</b>
            <em>L</em>
          </div>
          <div className="pa-card">
            <span>30 Days</span>
            <b>{fmtFuel(fuelForecast.day30)}</b>
            <em>L</em>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: DEPLETION FORECAST & RISK ── */}
      <div className="pa-section">
        <SectionHeader icon={CalendarClock} title="DEPLETION FORECAST" />
        <div className="pa-depletion">
          <div className={`pa-depletion-number ${depletionTone}`}>
            {fmtDays(depletion.daysRemaining)}
            <small>Days Remaining</small>
          </div>
          <div className="pa-depletion-meta">
            <span>Projected Depletion Date</span>
            <b>{depletion.projectedDate}</b>
            <small>
              Physical simulation model: fuel ÷ max(burnRate, 1). Driven by live SSE telemetry.
            </small>
          </div>
        </div>
        <div className="pa-risk-row">
          <div className="pa-risk-item warning">
            <AlertTriangle size={12} />
            <span>
              WARNING expected in <b>{fmtDays(risk.daysUntilWarning)} days</b>
            </span>
          </div>
          <div className="pa-risk-item danger">
            <AlertTriangle size={12} />
            <span>
              CRITICAL expected in <b>{fmtDays(risk.daysUntilCritical)} days</b>
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: SCENARIO IMPACT ── */}
      <div className="pa-section">
        <SectionHeader icon={Layers} title="SCENARIO IMPACT FORECAST" />
        <div className="pa-grid pa-grid-4">
          <div className={`pa-card ${!isBlizzardActive && !isGenFailureActive ? "scenario-live" : ""}`}>
            <span className="pa-card-header">
              Normal
              {!isBlizzardActive && !isGenFailureActive && <i className="pa-live-dot" />}
            </span>
            <b>{fmtDays(scenarios.normal)}</b>
            <em>days</em>
          </div>
          <div className={`pa-card storm ${isBlizzardActive && !isGenFailureActive ? "scenario-live" : ""}`}>
            <span className="pa-card-header">
              Blizzard
              {isBlizzardActive && !isGenFailureActive && <i className="pa-live-dot active-storm" />}
            </span>
            <b>{fmtDays(scenarios.blizzard)}</b>
            <em>days</em>
          </div>
          <div className={`pa-card failure ${isGenFailureActive && !isBlizzardActive ? "scenario-live" : ""}`}>
            <span className="pa-card-header">
              Generator Failure
              {isGenFailureActive && !isBlizzardActive && <i className="pa-live-dot active-failure" />}
            </span>
            <b>{fmtDays(scenarios.generatorFailure)}</b>
            <em>days</em>
          </div>
          <div className={`pa-card combined ${isCombinedActive ? "scenario-live" : ""}`}>
            <span className="pa-card-header">
              Combined
              {isCombinedActive && <i className="pa-live-dot active-combined" />}
            </span>
            <b>{fmtDays(scenarios.combined)}</b>
            <em>days</em>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: TREND ANALYSIS ── */}
      <div className="pa-section pa-section-last">
        <SectionHeader icon={BarChart3} title="REGRESSION TREND ANALYSIS" />
        <div className="pa-trend-row">
          <span>
            <TrendingDown size={12} /> Slope{" "}
            <b>{trend.slope.toFixed(2)} L / reading</b>
          </span>
          <span>
            Confidence <b>{trend.confidence}%</b>
          </span>
          <span>
            Regression Projected Depletion <b>{fmtDays(trend.days)} days</b>
          </span>
        </div>
      </div>
    </section>
  );
}
