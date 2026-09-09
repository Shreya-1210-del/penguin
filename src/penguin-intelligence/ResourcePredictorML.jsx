import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BrainCircuit, CalendarClock, Fuel, Gauge, Lightbulb, ShieldAlert,
  Snowflake, Sparkles, ThermometerSnowflake, Users, Wind, Zap,
} from "lucide-react";
import {
  compareScenarios, debounce, getForecast, getModelInfo, getRecommendation, predictResources,
} from "./penguinIntelligenceApi";
import "./penguinIntelligence.css";

const money = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.max(0, Number(n) || 0));
const RISK_COLOR = { STABLE: "#55e6a1", WATCH: "#ffc15a", HIGH: "#ff9a4d", CRITICAL: "#ff5d67" };
const SCENARIOS = ["NORMAL", "BLIZZARD", "GENERATOR_FAILURE", "COMBINED", "HIGH_LOAD"];

const initial = {
  station: "BHARATI",
  ambient_temp_c: -25,
  total_generators: 3,
  active_generators: null, // null = let the backend infer from the scenario
  generator_efficiency_percent: 100,
  power_load_kw: 182,
  wind_kmh: 20,
  personnel: 24,
  activity_level: 0.8,
  fuel_percent: 100,
  scenario: "NORMAL",
  blizzard_severity: null, // null = scenario default
  planning_days: 14,
  safety_buffer_percent: 15,
};

/* ---------- tiny dependency-free inline charts ---------- */

function LineChart({ series, width = 640, height = 140, color = "#58c8ff", fill = false, yFormat }) {
  if (!series || series.length < 2) return null;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const points = series.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 18) - 9]);
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = fill ? `${path} L${width},${height} L0,${height} Z` : "";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" preserveAspectRatio="none">
      {fill && <path d={areaPath} fill={color} opacity="0.12" stroke="none" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {points.length > 0 && <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />}
      <text x="4" y="14" className="chart-label">{yFormat ? yFormat(max) : Math.round(max)}</text>
      <text x="4" y={height - 4} className="chart-label">{yFormat ? yFormat(min) : Math.round(min)}</text>
    </svg>
  );
}

function DualLineChart({ a, b, width = 640, height = 140, colorA = "#58c8ff", colorB = "#6d8da2" }) {
  if (!a || !b || a.length < 2) return null;
  const all = [...a, ...b];
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const stepX = width / (a.length - 1);
  const toPath = (series) => series.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 18) - 9;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" preserveAspectRatio="none">
      <path d={toPath(b)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="4 3" />
      <path d={toPath(a)} fill="none" stroke={colorA} strokeWidth="2" />
    </svg>
  );
}

function RiskStrip({ days, risks }) {
  if (!risks || !risks.length) return null;
  return (
    <div className="risk-strip">
      {risks.map((r, i) => (
        <div key={i} className="risk-cell" style={{ background: RISK_COLOR[r] || "#333" }} title={`Day ${days[i]}: ${r}`} />
      ))}
    </div>
  );
}

function ExplainBars({ factors }) {
  if (!factors || !factors.length) return null;
  const max = Math.max(...factors.map((f) => f.weight_percent), 1);
  return (
    <div className="explain-bars">
      {factors.map((f) => (
        <div className="explain-row" key={f.feature}>
          <span className="explain-name">{f.feature.replaceAll("_", " ")}</span>
          <div className="explain-track"><div className="explain-fill" style={{ width: `${(f.weight_percent / max) * 100}%` }} /></div>
          <b>{f.weight_percent}%</b>
        </div>
      ))}
    </div>
  );
}

export default function ResourcePredictorML({ engine }) {
  const [controls, setControls] = useState(initial);
  const [prediction, setPrediction] = useState(null);
  const [compare, setCompare] = useState(null);
  const [forecast, setForecastData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  const payload = useMemo(() => ({
    ...controls,
    ambient_temp_c: Number(engine?.ambientTemp ?? controls.ambient_temp_c),
    power_load_kw: Number(engine?.powerLoadKW ?? controls.power_load_kw),
    fuel_percent: Number(
      engine?.currentFuel ? (engine.currentFuel / (engine.fuelTankCapacity || 120000)) * 100 : controls.fuel_percent
    ),
    scenario: engine?.scenario || controls.scenario,
  }), [controls, engine]);

  const debouncedRun = useRef(debounce(async (p, id, setters) => {
    const { setPrediction, setCompare, setForecastData, setRecommendation, setLoading, setError, isCurrent } = setters;
    setLoading(true); setError("");
    try {
      const [pred, cmp, fc, rec] = await Promise.all([
        predictResources(p), compareScenarios(p), getForecast(p), getRecommendation(p),
      ]);
      if (!isCurrent(id)) return; // a newer request superseded this one -- drop stale result
      setPrediction(pred); setCompare(cmp); setForecastData(fc); setRecommendation(rec);
    } catch (e) {
      if (!isCurrent(id)) return;
      setError(
        e?.message === "PENGUIN_API_UNREACHABLE"
          ? "Backend unavailable. Start the FastAPI intelligence service on port 8000."
          : `Prediction failed: ${e.message}`
      );
    } finally {
      if (isCurrent(id)) setLoading(false);
    }
  }, 350));

  useEffect(() => { getModelInfo().then(setModelInfo).catch(() => {}); }, []);

  useEffect(() => {
    reqIdRef.current += 1;
    const id = reqIdRef.current;
    debouncedRun.current(payload, id, {
      setPrediction, setCompare, setForecastData, setRecommendation, setLoading, setError,
      isCurrent: (rid) => rid === reqIdRef.current,
    });
    // Intentionally reacts to every control that affects the request payload, including live engine sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    payload.station, payload.ambient_temp_c, payload.total_generators, payload.active_generators,
    payload.generator_efficiency_percent, payload.power_load_kw, payload.wind_kmh, payload.personnel,
    payload.activity_level, payload.fuel_percent, payload.scenario, payload.blizzard_severity,
    payload.planning_days, payload.safety_buffer_percent,
  ]);

  const riskClass = prediction?.risk?.toLowerCase() || "watch";
  const showBlizzardSlider = payload.scenario === "BLIZZARD" || payload.scenario === "COMBINED";
  const set = (patch) => setControls((c) => ({ ...c, ...patch }));

  return (
    <section className="intel-panel" id="resource-ml">
      <div className="intel-head">
        <div>
          <span className="intel-eyebrow"><BrainCircuit size={14} /> PENGUIN RESOURCE INTELLIGENCE / ML</span>
          <h2>Predict what the station needs next.</h2>
          <p>
            A FastAPI RandomForest ensemble trained only on synthetic operational states drives this panel.
            Change conditions below, or let live dashboard telemetry drive it, then stress-test with an emergency scenario.
          </p>
        </div>
        <div className={`intel-risk ${riskClass}`}>
          <ShieldAlert size={15} /><b>{prediction?.risk || "CONNECTING"}</b><small>RESOURCE RISK</small>
        </div>
      </div>

      <div className="intel-live-grid">
        <div className="intel-card live"><span>LIVE INPUT</span><b>{payload.ambient_temp_c.toFixed(1)}°C</b><small>ambient</small></div>
        <div className="intel-card live"><span>STATION</span><b>{payload.station}</b><small>selected</small></div>
        <div className="intel-card live"><span>POWER LOAD</span><b>{Math.round(payload.power_load_kw)} kW</b><small>simulated</small></div>
        <div className="intel-card live"><span>SCENARIO</span><b>{payload.scenario.replaceAll("_", " ")}</b><small>current</small></div>
      </div>

      <div className="intel-controls">
        <label>
          <ThermometerSnowflake size={14} /> Station
          <select value={controls.station} onChange={(e) => set({ station: e.target.value })}>
            <option value="BHARATI">Bharati</option>
            <option value="MAITRI">Maitri</option>
          </select>
          <b></b>
        </label>
        <label>
          <Zap size={14} /> Scenario
          <select value={controls.scenario} onChange={(e) => set({ scenario: e.target.value, blizzard_severity: null, active_generators: null })}>
            {SCENARIOS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
          </select>
          <b></b>
        </label>
        <label>
          <Fuel size={14} /> Fuel level
          <input type="range" min="0" max="100" value={controls.fuel_percent} onChange={(e) => set({ fuel_percent: +e.target.value })} />
          <b>{controls.fuel_percent}%</b>
        </label>
        <label>
          <Snowflake size={14} /> Ambient temp
          <input type="range" min="-70" max="5" value={controls.ambient_temp_c} onChange={(e) => set({ ambient_temp_c: +e.target.value })} />
          <b>{controls.ambient_temp_c}°C</b>
        </label>
        <label>
          <Gauge size={14} /> Generator efficiency
          <input type="range" min="25" max="100" value={controls.generator_efficiency_percent} onChange={(e) => set({ generator_efficiency_percent: +e.target.value })} />
          <b>{controls.generator_efficiency_percent}%</b>
        </label>
        <label>
          <Zap size={14} /> Total generators
          <input type="range" min="1" max="6" value={controls.total_generators} onChange={(e) => set({ total_generators: +e.target.value })} />
          <b>{controls.total_generators}</b>
        </label>
        <label>
          <Users size={14} /> Personnel
          <input type="range" min="8" max="60" value={controls.personnel} onChange={(e) => set({ personnel: +e.target.value })} />
          <b>{controls.personnel}</b>
        </label>
        <label>
          <Wind size={14} /> Wind
          <input type="range" min="0" max="100" value={controls.wind_kmh} onChange={(e) => set({ wind_kmh: +e.target.value })} />
          <b>{controls.wind_kmh} km/h</b>
        </label>
        <label>
          <Activity size={14} /> Station load
          <input type="range" min="0.4" max="1.4" step="0.1" value={controls.activity_level} onChange={(e) => set({ activity_level: +e.target.value })} />
          <b>{controls.activity_level.toFixed(1)}x</b>
        </label>
        {showBlizzardSlider && (
          <label>
            <Snowflake size={14} /> Blizzard severity
            <input
              type="range" min="0" max="5" step="0.5"
              value={controls.blizzard_severity ?? 4}
              onChange={(e) => set({ blizzard_severity: +e.target.value })}
            />
            <b>{(controls.blizzard_severity ?? 4).toFixed(1)}</b>
          </label>
        )}
        <label>
          <CalendarClock size={14} /> Planning horizon
          <input type="range" min="1" max="60" value={controls.planning_days} onChange={(e) => set({ planning_days: +e.target.value })} />
          <b>{controls.planning_days} days</b>
        </label>
        <label>
          <ShieldAlert size={14} /> Safety buffer
          <input type="range" min="0" max="50" value={controls.safety_buffer_percent} onChange={(e) => set({ safety_buffer_percent: +e.target.value })} />
          <b>{controls.safety_buffer_percent}%</b>
        </label>
      </div>

      {error && <div className="intel-error">{error}</div>}

      {prediction && (
        <>
          <div className="prediction-hero">
            <div>
              <span>MODEL ESTIMATE</span>
              <strong>{prediction.estimated_survival_days.toFixed(1)} days</strong>
              <small>current fuel endurance under selected scenario · depletes ~{prediction.estimated_depletion_date}</small>
            </div>
            <div className="burn"><Fuel size={19} /><b>{prediction.effective_burn_lph.toFixed(1)} L/h</b><small>effective burn</small></div>
            <div className="burn"><Gauge size={19} /><b>{prediction.recommended_procurement_lead_days.toFixed(0)} days</b><small>procurement trigger window</small></div>
          </div>

          <div className="reason-banner"><Lightbulb size={15} /><span>{prediction.explanation}</span></div>

          <div className="resource-grid">
            {[["diesel_liters", "Diesel", Fuel], ["power_kwh", "Power", Zap], ["ration_packs", "Rations", Users], ["medical_kits", "Medical", ShieldAlert], ["critical_spares", "Critical spares", Gauge]].map(([key, label, Icon]) => (
              <div className="resource-tile" key={key}>
                <Icon size={16} /><span>{label}</span>
                <b>{money(prediction.buffered_requirement[key])}</b>
                <small>incl. {controls.safety_buffer_percent}% safety buffer</small>
                <em>+{money(prediction.emergency_extra_requirement[key])} vs normal</em>
              </div>
            ))}
          </div>

          {recommendation && (
            <div className="recommend-box">
              <span className="intel-eyebrow"><Sparkles size={13} /> RECOMMENDATION ENGINE</span>
              <ul>{recommendation.recommendations.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </div>
          )}

          <div className="explain-box">
            <span className="intel-eyebrow"><BrainCircuit size={13} /> WHY THIS PREDICTION (model feature importance)</span>
            <ExplainBars factors={prediction.top_factors} />
          </div>

          {compare && (
            <div className="scenario-strip">
              <div><span>EMERGENCY DELTA</span><b>How much extra will the crisis cost?</b></div>
              {SCENARIOS.map((s) => {
                const delta = compare.deltas_vs_normal?.[s];
                const pct = delta?.additional_consumption_percent ?? 0;
                return (
                  <div className={`scenario-chip ${s === payload.scenario ? "selected" : ""}`} key={s}>
                    <span>{s.replaceAll("_", " ")}</span>
                    <b>{s === "NORMAL" ? "BASE" : `+${pct.toFixed(0)}%`}</b>
                    {delta && <small>{compare.scenarios[s].estimated_survival_days.toFixed(0)}d reserve</small>}
                  </div>
                );
              })}
            </div>
          )}

          {forecast && (
            <div className="chart-grid">
              <div className="chart-card">
                <span className="chart-title">Resource reserve over time</span>
                <LineChart series={forecast.reserve_liters} color="#4de0a1" fill yFormat={(v) => `${Math.round(v / 1000)}k L`} />
              </div>
              <div className="chart-card">
                <span className="chart-title">Predicted daily consumption</span>
                <LineChart series={forecast.daily_consumption_liters} color="#ffc15a" yFormat={(v) => `${Math.round(v)} L`} />
              </div>
              <div className="chart-card">
                <span className="chart-title">Normal vs {payload.scenario.replaceAll("_", " ")} reserve</span>
                <DualLineChart a={forecast.reserve_liters} b={forecast.normal_reserve_liters} />
                <div className="chart-legend"><span className="dot" style={{ background: "#58c8ff" }} /> {payload.scenario.replaceAll("_", " ")} <span className="dot" style={{ background: "#6d8da2" }} /> Normal</div>
              </div>
              <div className="chart-card">
                <span className="chart-title">Risk level over time</span>
                <RiskStrip days={forecast.days} risks={forecast.risk_level_by_day} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="model-foot">
        <span><Sparkles size={13} /> Synthetic training only</span>
        <span>{modelInfo ? `${modelInfo.synthetic_rows} rows · ${modelInfo.model}` : "Loading model metadata..."}</span>
        <span>{loading ? "UPDATING..." : "LIVE"}</span>
      </div>
    </section>
  );
}
