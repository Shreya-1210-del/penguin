"""
Penguin Intelligence API
------------------------
FastAPI backend for the Resource Intelligence ML model and the grounded Penguin AI
assistant. This service is intentionally standalone: it does not import or depend on
the rest of the Penguin frontend/backend, and communicates only through this HTTP API
(see PENGUIN_CORS_ORIGINS). This keeps it safe to develop independently of whatever
else the wider Penguin project's backend team is building.

All resource numbers returned by this service are derived from SYNTHETIC prototype
data (see synthetic_data.py) -- this service has no access to, and makes no claim
about, real Bharati/Maitri station telemetry.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import knowledge_base as kb
from . import physics
from . import synthetic_data as sd
from .ml_engine import ResourceIntelligenceEngine
from .schemas import ChatRequest, PredictRequest, TrainRequest

load_dotenv()  # loads backend/.env if present (PENGUIN_CORS_ORIGINS, OPENAI_API_KEY, OPENAI_MODEL)

APP_VERSION = "2.0.0"

app = FastAPI(
    title="Penguin Intelligence API",
    version=APP_VERSION,
    description="Resource-demand ML forecasting and the grounded Penguin AI assistant for the Penguin Antarctic Digital Twin prototype.",
)

origins = [x.strip() for x in os.getenv("PENGUIN_CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Trained once at process startup and cached. Only /api/ml/train ever retrains it --
# never a per-prediction cost (Part 15, performance).
engine = ResourceIntelligenceEngine()


# ---------------------------------------------------------------------------
# Shared prediction logic
# ---------------------------------------------------------------------------

def _feature_row(req: PredictRequest, *, active_generators: int | None = None, blizzard_severity: float | None = None, scenario: str | None = None) -> list[float]:
    scenario_val = scenario or req.scenario
    severity = blizzard_severity if blizzard_severity is not None else req.blizzard_severity
    if severity is None:
        severity = physics.SCENARIO_DEFAULT_BLIZZARD_SEVERITY.get(scenario_val, 0.0)
    override_generators = active_generators if active_generators is not None else req.active_generators
    generators = physics.resolve_active_generators(req.total_generators, scenario_val, override_generators)
    habitat = req.habitat_temp_c if req.habitat_temp_c is not None else req.ambient_temp_c + 18.0
    return [
        req.ambient_temp_c,
        habitat,
        generators,
        req.generator_efficiency_percent,
        req.power_load_kw,
        req.wind_kmh,
        req.personnel,
        req.activity_level,
        req.fuel_percent,
        physics.emergency_level(scenario_val),
        severity,
        req.planning_days,
        1.0 if req.station == "MAITRI" else 0.0,
    ]


def _resolved_burn(req: PredictRequest) -> tuple[float, int, float]:
    generators = physics.resolve_active_generators(req.total_generators, req.scenario, req.active_generators)
    severity = req.blizzard_severity if req.blizzard_severity is not None else physics.SCENARIO_DEFAULT_BLIZZARD_SEVERITY.get(req.scenario, 0.0)
    burn = physics.effective_burn(req.ambient_temp_c, generators, req.scenario, req.generator_efficiency_percent, severity, total_generators=req.total_generators)
    return burn, generators, severity


def predict_payload(req: PredictRequest) -> dict[str, Any]:
    features = _feature_row(req)
    prediction = engine.predict(features)

    normal_features = _feature_row(req, active_generators=req.total_generators, blizzard_severity=0.0, scenario="NORMAL")
    normal_req = engine.predict(normal_features)

    buffered = {k: v * (1 + req.safety_buffer_percent / 100) for k, v in prediction.items()}
    extra = {k: max(0.0, prediction[k] - normal_req[k]) for k in prediction}

    burn, active_generators, severity = _resolved_burn(req)
    normal_burn = physics.effective_burn(req.ambient_temp_c, req.total_generators, "NORMAL", 100.0, 0.0, total_generators=req.total_generators)

    fuel_capacity = physics.station_fuel_capacity(req.station)
    current_fuel = fuel_capacity * req.fuel_percent / 100
    survival_days = current_fuel / max(burn * 24, 1e-6)
    normal_survival_days = current_fuel / max(normal_burn * 24, 1e-6)
    procurement_days = max(0.0, survival_days - 7)

    risk = (
        "CRITICAL" if survival_days < 15 or req.scenario == "COMBINED"
        else "HIGH" if req.scenario != "NORMAL" or survival_days < 30
        else "WATCH" if survival_days < 60
        else "STABLE"
    )

    depletion_date = (datetime.now(timezone.utc) + timedelta(days=survival_days)).date().isoformat()
    recommended_reserve = extra["diesel_liters"] * 1.1

    top_factors = engine.explain_prediction(features, resource="diesel_liters", top_k=5)
    explanation = _human_explanation(top_factors, req)

    return {
        "prediction": prediction,
        "buffered_requirement": buffered,
        "emergency_extra_requirement": extra,
        "normal_baseline": normal_req,
        "effective_burn_lph": burn,
        "normal_burn_lph": normal_burn,
        "active_generators": active_generators,
        "blizzard_severity": severity,
        "estimated_survival_days": survival_days,
        "normal_survival_days": normal_survival_days,
        "reduction_in_survival_days": max(0.0, normal_survival_days - survival_days),
        "estimated_depletion_date": depletion_date,
        "recommended_procurement_lead_days": procurement_days,
        "recommended_emergency_reserve_liters": recommended_reserve,
        "risk": risk,
        "scenario": req.scenario,
        "station": req.station,
        "model_rows": engine.result.rows if engine.result else 0,
        "model_version": APP_VERSION,
        "top_factors": top_factors,
        "explanation": explanation,
        "data_disclaimer": "SYNTHETIC PROTOTYPE DATA -- not real Bharati/Maitri telemetry.",
    }


def _human_explanation(top_factors: list[dict], req: PredictRequest) -> str:
    if not top_factors:
        return "No single factor dominates the current prediction."
    named = {
        "ambient_temp_c": "ambient temperature",
        "habitat_temp_c": "habitat temperature",
        "active_generators": "the number of active generators",
        "generator_efficiency_percent": "generator efficiency",
        "power_load_kw": "power load",
        "wind_kmh": "wind speed",
        "personnel": "personnel count",
        "activity_level": "activity level",
        "fuel_percent": "current fuel level",
        "emergency_level": "the active emergency scenario",
        "blizzard_severity": "blizzard severity",
        "planning_days": "the planning horizon",
        "station_is_maitri": "which station is selected",
    }
    top_two = top_factors[:2]
    phrases = [f"{named.get(f['feature'], f['feature'])} is {f['direction']}" for f in top_two]
    verb = "increased" if req.scenario != "NORMAL" or req.ambient_temp_c < -30 else "was shaped"
    return f"Projected demand {verb} primarily because " + " and ".join(phrases) + "."


# ---------------------------------------------------------------------------
# Existing endpoints (kept backward compatible; response fields only ever added to)
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "penguin-intelligence",
        "version": APP_VERSION,
        "utc": datetime.now(timezone.utc).isoformat(),
        "model_rows": engine.result.rows if engine.result else 0,
    }


@app.get("/api/ml/model-info")
def model_info() -> dict[str, Any]:
    assert engine.result is not None
    return {
        "model": "RandomForestRegressor ensemble (one model per resource)",
        "resources": sd.RESOURCE_NAMES,
        "features": sd.FEATURE_NAMES,
        "synthetic_rows": engine.result.rows,
        "seed": engine.result.seed,
        "version": APP_VERSION,
        "feature_importance": {k: v for k, v in engine.result.feature_importance.items()},
        "aggregate_feature_importance": engine.aggregate_feature_importance(),
        "data_disclaimer": "SYNTHETIC PROTOTYPE DATA -- not real Bharati/Maitri telemetry.",
    }


@app.post("/api/ml/train")
def train(req: TrainRequest) -> dict[str, Any]:
    result = engine.train(req.rows, req.seed)
    return {
        "status": "trained",
        "rows": result.rows,
        "seed": result.seed,
        "training_seconds": round(result.training_seconds, 3),
        "model": "RandomForestRegressor ensemble",
        "metrics": engine.metrics_payload()["per_resource"],
    }


@app.post("/api/ml/predict-resources")
def predict_resources(req: PredictRequest) -> dict[str, Any]:
    return predict_payload(req)


@app.post("/api/ml/scenario-compare")
def scenario_compare(req: PredictRequest) -> dict[str, Any]:
    results = {}
    normal_result = None
    for scenario in physics.SCENARIOS:
        clone = req.model_copy(update={"scenario": scenario, "active_generators": None, "blizzard_severity": None})
        payload = predict_payload(clone)
        results[scenario] = payload
        if scenario == "NORMAL":
            normal_result = payload

    deltas = {}
    for scenario, payload in results.items():
        if scenario == "NORMAL" or normal_result is None:
            continue
        base_diesel = normal_result["prediction"]["diesel_liters"]
        this_diesel = payload["prediction"]["diesel_liters"]
        deltas[scenario] = {
            "additional_diesel_liters": max(0.0, this_diesel - base_diesel),
            "additional_consumption_percent": round(100 * (this_diesel - base_diesel) / base_diesel, 1) if base_diesel else 0.0,
            "reduction_in_survival_days": max(0.0, normal_result["estimated_survival_days"] - payload["estimated_survival_days"]),
            "new_depletion_estimate": payload["estimated_depletion_date"],
            "recommended_emergency_reserve_liters": payload["recommended_emergency_reserve_liters"],
            "risk_escalation": payload["risk"] != normal_result["risk"],
        }

    return {"scenarios": results, "deltas_vs_normal": deltas}


# ---------------------------------------------------------------------------
# New endpoints
# ---------------------------------------------------------------------------

@app.post("/api/ml/forecast")
def forecast(req: PredictRequest) -> dict[str, Any]:
    """Day-by-day reserve/consumption/risk projection over the planning horizon,
    for the reserve-over-time, consumption-over-time, and risk-over-time charts."""
    burn, generators, severity = _resolved_burn(req)
    normal_burn = physics.effective_burn(req.ambient_temp_c, req.total_generators, "NORMAL", 100.0, 0.0, total_generators=req.total_generators)
    fuel_capacity = physics.station_fuel_capacity(req.station)
    current_fuel = fuel_capacity * req.fuel_percent / 100

    days = list(range(0, req.planning_days + 1))
    reserve_series, normal_reserve_series, consumption_series, risk_series = [], [], [], []
    for d in days:
        reserve = max(0.0, current_fuel - burn * 24 * d)
        normal_reserve = max(0.0, current_fuel - normal_burn * 24 * d)
        remaining_days = reserve / max(burn * 24, 1e-6)
        risk = (
            "CRITICAL" if remaining_days < 15 or req.scenario == "COMBINED"
            else "HIGH" if req.scenario != "NORMAL" or remaining_days < 30
            else "WATCH" if remaining_days < 60
            else "STABLE"
        )
        reserve_series.append(round(reserve, 1))
        normal_reserve_series.append(round(normal_reserve, 1))
        consumption_series.append(round(burn * 24, 1))
        risk_series.append(risk)

    return {
        "days": days,
        "reserve_liters": reserve_series,
        "normal_reserve_liters": normal_reserve_series,
        "daily_consumption_liters": consumption_series,
        "risk_level_by_day": risk_series,
        "scenario": req.scenario,
        "station": req.station,
        "data_disclaimer": "SYNTHETIC PROTOTYPE DATA -- not real Bharati/Maitri telemetry.",
    }


@app.post("/api/ml/recommend")
def recommend(req: PredictRequest) -> dict[str, Any]:
    payload = predict_payload(req)

    gen_failure_clone = req.model_copy(update={"scenario": "GENERATOR_FAILURE", "active_generators": None, "blizzard_severity": None})
    gen_failure_payload = predict_payload(gen_failure_clone)
    normal_clone = req.model_copy(update={"scenario": "NORMAL", "active_generators": None, "blizzard_severity": None})
    normal_payload = predict_payload(normal_clone)

    base_diesel = normal_payload["prediction"]["diesel_liters"]
    gen_failure_pct = round(100 * (gen_failure_payload["prediction"]["diesel_liters"] - base_diesel) / base_diesel, 1) if base_diesel else 0.0
    safety_threshold_days = payload["estimated_survival_days"] * (1 - req.safety_buffer_percent / 100)

    recommendations = [
        f"Additional fuel recommended within {payload['recommended_procurement_lead_days']:.0f} days to stay ahead of the 7-day safety margin.",
        f"Maintain an emergency reserve of approximately {payload['recommended_emergency_reserve_liters']:.0f} liters to cover a sudden scenario escalation.",
        f"A generator failure would increase projected fuel demand by roughly {gen_failure_pct:.0f}% versus normal operation.",
        f"At the current {req.safety_buffer_percent:.0f}% safety buffer, reserves would fall below the configured threshold in about {safety_threshold_days:.0f} days.",
    ]
    if payload["risk"] in ("HIGH", "CRITICAL"):
        recommendations.insert(0, f"Risk is currently {payload['risk']} -- prioritize resupply planning over routine tasks.")

    return {
        "recommendations": recommendations,
        "risk": payload["risk"],
        "estimated_survival_days": payload["estimated_survival_days"],
        "recommended_emergency_reserve_liters": payload["recommended_emergency_reserve_liters"],
        "generator_failure_demand_increase_percent": gen_failure_pct,
        "data_disclaimer": "SYNTHETIC PROTOTYPE DATA -- not real Bharati/Maitri telemetry.",
    }


@app.get("/api/ml/metrics")
def metrics() -> dict[str, Any]:
    return engine.metrics_payload()


@app.get("/api/ml/feature-importance")
def feature_importance() -> dict[str, Any]:
    assert engine.result is not None
    return {
        "per_resource": engine.result.feature_importance,
        "aggregate": engine.aggregate_feature_importance(),
        "note": "Derived directly from trained RandomForestRegressor.feature_importances_, not hand-assigned.",
    }


@app.get("/api/assistant/facts")
def facts(category: str | None = Query(default=None)) -> dict[str, Any]:
    return {"facts": kb.facts_by_category(category), "categories": sorted({f["category"] for f in kb.FACTS})}


@app.get("/api/assistant/facts/random")
def random_fact(category: str | None = Query(default=None)) -> dict[str, Any]:
    return kb.random_fact(category)


@app.post("/api/assistant/chat")
def assistant_chat(req: ChatRequest) -> dict[str, Any]:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message must not be empty")
    return kb.compose_answer(req.message, req.context)
