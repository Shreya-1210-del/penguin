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

import logging
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import knowledge_base as kb
from . import physics
from . import synthetic_data as sd
from .ml_engine import ResourceIntelligenceEngine
from .schemas import ChatRequest, PredictRequest, TrainRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("penguin.api")

load_dotenv()  # loads .env if present (PENGUIN_CORS_ORIGINS, OPENAI_API_KEY, OPENAI_MODEL)

APP_VERSION = "2.0.0"
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "production"))

# CORS configuration
raw_cors = os.getenv("PENGUIN_CORS_ORIGINS", os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"))
origins = [x.strip().rstrip("/") for x in raw_cors.split(",") if x.strip()]

# Trained once at process startup and cached.
engine = ResourceIntelligenceEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation
    logger.info("[STARTUP] Validating Penguin Intelligence Service configuration...")
    logger.info("[STARTUP] Version: %s | Environment: %s", APP_VERSION, ENVIRONMENT)
    logger.info("[STARTUP] CORS Allowed Origins: %s", origins)

    # Validate ML Models
    if engine.is_ready():
        logger.info(
            "[STARTUP] ML Engine: READY (%d resource models loaded, %d synthetic training rows)",
            len(engine.models),
            engine.result.rows if engine.result else 0,
        )
    else:
        logger.warning("[STARTUP] ML Engine: INITIALIZED WITH FALLBACK HEURISTICS")

    # Validate Knowledge Base
    if kb.is_ready():
        logger.info("[STARTUP] Knowledge Base: READY (%d articles, %d facts)", len(kb.KNOWLEDGE), len(kb.FACTS))
    else:
        logger.warning("[STARTUP] Knowledge Base: WARNING (partial or uninitialized knowledge base)")

    # Validate Assistant
    try:
        sample_retrieval = kb.retrieve("station fuel")
        logger.info("[STARTUP] Assistant retrieval pipeline: READY (sample hits=%d)", len(sample_retrieval))
    except Exception as exc:
        logger.error("[STARTUP] Assistant retrieval check failed: %s", exc)

    # Validate optional OpenAI LLM integration
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key and api_key.lower() not in ("your_openai_api_key_here", "sk-placeholder", "none", "null") and len(api_key) >= 15:
        logger.info("[STARTUP] Optional OpenAI LLM integration: ENABLED")
    else:
        logger.info("[STARTUP] Optional OpenAI LLM integration: DISABLED (using grounded deterministic local engine)")

    yield

    logger.info("[SHUTDOWN] Penguin Intelligence Service shutting down gracefully.")


app = FastAPI(
    title="Penguin Intelligence API",
    version=APP_VERSION,
    description="Resource-demand ML forecasting and the grounded Penguin AI assistant for the Penguin Antarctic Digital Twin prototype.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Lightweight in-memory rate limiter (per client IP)
_client_requests: dict[str, list[float]] = defaultdict(list)
try:
    RATE_LIMIT_WINDOW_SEC = max(1.0, float(os.getenv("RATE_LIMIT_WINDOW_SEC", "60.0")))
except ValueError:
    RATE_LIMIT_WINDOW_SEC = 60.0

try:
    RATE_LIMIT_MAX_CALLS = max(1, int(os.getenv("RATE_LIMIT_MAX_CALLS", "120")))
except ValueError:
    RATE_LIMIT_MAX_CALLS = 120


@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Rate limit check (exclude health checks)
    if not request.url.path.startswith(("/health", "/api/health")):
        timestamps = [t for t in _client_requests[client_ip] if now - t < RATE_LIMIT_WINDOW_SEC]
        timestamps.append(now)
        _client_requests[client_ip] = timestamps
        if len(timestamps) > RATE_LIMIT_MAX_CALLS:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Maximum {RATE_LIMIT_MAX_CALLS} requests per minute."},
                headers={"Retry-After": "60"},
            )

        # Cleanup client requests memory periodically
        if len(_client_requests) > 500:
            stale = [k for k, v in _client_requests.items() if not v or (now - v[-1] > RATE_LIMIT_WINDOW_SEC)]
            for k in stale:
                _client_requests.pop(k, None)

    try:
        start_time = time.time()
        response: Response = await call_next(request)
        process_time = time.time() - start_time
        if request.url.path.startswith("/api/ml/"):
            logger.info("ML_ENDPOINT_TIMING %s completed in %.3fs", request.url.path, process_time)
    except Exception as exc:
        logger.error("Unhandled error in request pipeline (%s): %s", request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error occurred in Penguin Intelligence service."},
        )

    # Attach secure headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed",
            "errors": [{"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]} for err in exc.errors()],
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred in Penguin Intelligence service."},
    )



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


def predict_payload(req: PredictRequest, normal_baseline: dict[str, float] | None = None) -> dict[str, Any]:
    features = _feature_row(req)
    prediction = engine.predict(features)

    if normal_baseline is None:
        normal_features = _feature_row(req, active_generators=req.total_generators, blizzard_severity=0.0, scenario="NORMAL")
        normal_req = engine.predict(normal_features)
    else:
        normal_req = normal_baseline

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

@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "penguin-intelligence",
        "version": APP_VERSION,
        "utc": datetime.now(timezone.utc).isoformat(),
        "model_rows": engine.result.rows if engine.result else 0,
        "models_loaded": bool(engine.models),
        "knowledge_base_loaded": len(kb.KNOWLEDGE) > 0,
    }


@app.get("/health/live")
@app.get("/api/health/live")
def health_live() -> dict[str, Any]:
    """Liveness probe: verifies process is responding."""
    return {"status": "alive", "service": "penguin-intelligence", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/health/ready")
@app.get("/api/health/ready")
def health_ready() -> dict[str, Any]:
    """Readiness probe: verifies ML models, knowledge base, and assistant pipeline are ready to serve."""
    models_ready = bool(engine.is_ready())
    kb_ready = bool(kb.is_ready())
    assistant_ready = kb.retrieve("test question") is not None

    all_ready = models_ready and kb_ready and assistant_ready
    status_code = 200 if all_ready else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ready else "not_ready",
            "service": "penguin-intelligence",
            "version": APP_VERSION,
            "components": {
                "fastapi_running": True,
                "ml_models_loaded": models_ready,
                "knowledge_base_loaded": kb_ready,
                "assistant_available": assistant_ready,
            },
            "model_resources": list(engine.models.keys()) if engine.models else list(sd.RESOURCE_NAMES),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.get("/api/ml/model-info")
def model_info() -> dict[str, Any]:
    res = engine.result
    return {
        "model": "RandomForestRegressor ensemble (one model per resource)",
        "resources": sd.RESOURCE_NAMES,
        "features": sd.FEATURE_NAMES,
        "synthetic_rows": res.rows if res else 0,
        "seed": res.seed if res else 0,
        "version": APP_VERSION,
        "feature_importance": {k: v for k, v in res.feature_importance.items()} if res else {},
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
    
    # Pre-compute NORMAL baseline once
    normal_clone = req.model_copy(update={"scenario": "NORMAL", "active_generators": None, "blizzard_severity": None})
    normal_result = predict_payload(normal_clone)
    results["NORMAL"] = normal_result
    normal_baseline = normal_result["prediction"]

    for scenario in physics.SCENARIOS:
        if scenario == "NORMAL":
            continue
        clone = req.model_copy(update={"scenario": scenario, "active_generators": None, "blizzard_severity": None})
        payload = predict_payload(clone, normal_baseline=normal_baseline)
        results[scenario] = payload

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
async def forecast(req: PredictRequest) -> dict[str, Any]:
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
    # Compute normal baseline first if the request isn't already NORMAL
    if req.scenario == "NORMAL":
        normal_payload = predict_payload(req)
        payload = normal_payload
    else:
        normal_clone = req.model_copy(update={"scenario": "NORMAL", "active_generators": None, "blizzard_severity": None})
        normal_payload = predict_payload(normal_clone)
        payload = predict_payload(req, normal_baseline=normal_payload["prediction"])

    # Pass the normal_baseline to generator failure prediction to save computation
    if req.scenario == "GENERATOR_FAILURE":
        gen_failure_payload = payload
    else:
        gen_failure_clone = req.model_copy(update={"scenario": "GENERATOR_FAILURE", "active_generators": None, "blizzard_severity": None})
        gen_failure_payload = predict_payload(gen_failure_clone, normal_baseline=normal_payload["prediction"])

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
    res = engine.result
    return {
        "per_resource": res.feature_importance if res else {},
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
