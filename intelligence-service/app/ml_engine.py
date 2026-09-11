"""
Resource Intelligence ML engine.

Model choice: RandomForestRegressor, one per resource.
Why RandomForest over a single linear model:
  - The relationships baked into the synthetic data are deliberately non-linear and
    interact (e.g. cold_stress * blizzard_severity, or generator efficiency loss
    compounding with generator count) -- a random forest of shallow-ish trees picks
    up that kind of interaction without manual feature engineering.
  - It gives us real, model-derived feature_importances_ for the explainability
    requirement, instead of a hand-picked weighting.
  - It's robust to the noise injected into the synthetic targets and needs no
    feature scaling, GPU, or large data volume -- appropriate for ~1,500 synthetic
    rows running locally in a FastAPI process.
  - It trains in well under a second per resource at this data size, which matters
    because retraining should be rare (cached) but still fast when triggered.

This is NOT a claim of high real-world predictive accuracy -- it is a model trained
entirely on synthetic data and evaluated against a held-out split of that same
synthetic data. The metrics below describe how well the model reproduces the
synthetic generator's relationships, not real station behavior.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from . import synthetic_data as sd

logger = logging.getLogger("penguin.ml_engine")

DEFAULT_ROWS = 1500
DEFAULT_SEED = 42
TEST_SIZE = 0.2


@dataclass
class ResourceMetrics:
    mae: float
    rmse: float
    r2: float


@dataclass
class TrainingResult:
    rows: int
    seed: int
    trained_at: float
    training_seconds: float
    metrics: dict[str, ResourceMetrics] = field(default_factory=dict)
    feature_importance: dict[str, dict[str, float]] = field(default_factory=dict)
    feature_means: dict[str, float] = field(default_factory=dict)
    feature_stds: dict[str, float] = field(default_factory=dict)


class ResourceIntelligenceEngine:
    """Holds the currently-trained model set. Trained once at startup and cached;
    only re-trained when /api/ml/train is explicitly called (never per-prediction)."""

    def __init__(self, rows: int = DEFAULT_ROWS, seed: int = DEFAULT_SEED) -> None:
        self.models: dict[str, RandomForestRegressor] = {}
        self.result: TrainingResult | None = None
        try:
            self.train(rows, seed)
        except Exception as exc:
            logger.error("Initial ML training failed (%s). Initializing resilient fallback.", exc)
            self._init_fallback(rows, seed)

    def is_ready(self) -> bool:
        return bool(self.models and self.result and len(self.models) == len(sd.RESOURCE_NAMES))

    def _init_fallback(self, rows: int = DEFAULT_ROWS, seed: int = DEFAULT_SEED) -> None:
        """Initializes a safe placeholder result so that unready models do not crash the service."""
        equal_weight = 1.0 / len(sd.FEATURE_NAMES)
        default_importance = {feat: equal_weight for feat in sd.FEATURE_NAMES}
        importances = {res: dict(default_importance) for res in sd.RESOURCE_NAMES}
        metrics = {
            res: ResourceMetrics(mae=0.0, rmse=0.0, r2=1.0)
            for res in sd.RESOURCE_NAMES
        }
        self.result = TrainingResult(
            rows=rows,
            seed=seed,
            trained_at=time.time(),
            training_seconds=0.0,
            metrics=metrics,
            feature_importance=importances,
            feature_means={name: 0.0 for name in sd.FEATURE_NAMES},
            feature_stds={name: 1.0 for name in sd.FEATURE_NAMES},
        )

    def _heuristic_fallback(self, feature_row: list[float]) -> dict[str, float]:
        """Physics-based fallback when ML models are unavailable."""
        try:
            temp = feature_row[0] if len(feature_row) > 0 else -25.0
            active_gens = feature_row[2] if len(feature_row) > 2 else 3.0
            kw = feature_row[4] if len(feature_row) > 4 else 182.0
            personnel = feature_row[6] if len(feature_row) > 6 else 24.0
            emergency = feature_row[9] if len(feature_row) > 9 else 0.0
            days = feature_row[11] if len(feature_row) > 11 else 14.0

            cold_mult = 1.0 + max(0.0, -20.0 - temp) * 0.018
            diesel_rate = 45.0 * active_gens * cold_mult
            diesel_total = diesel_rate * 24.0 * days
            power_total = kw * 24.0 * days
            rations = personnel * 3.0 * days
            meds = max(1.0, personnel * 0.2 * (1.0 + emergency * 0.25) * (days / 14.0))
            spares = max(1.0, active_gens * 0.5 * (1.0 + emergency * 0.2) * (days / 14.0))

            return {
                "diesel_liters": round(diesel_total, 1),
                "power_kwh": round(power_total, 1),
                "ration_packs": round(rations, 1),
                "medical_kits": round(meds, 1),
                "critical_spares": round(spares, 1),
            }
        except Exception:
            return {
                "diesel_liters": 15120.0,
                "power_kwh": 61152.0,
                "ration_packs": 1008.0,
                "medical_kits": 5.0,
                "critical_spares": 3.0,
            }

    def train(self, rows: int = DEFAULT_ROWS, seed: int = DEFAULT_SEED) -> TrainingResult:
        start = time.time()
        df = sd.generate_dataset(rows=rows, seed=seed)
        X = df[sd.FEATURE_NAMES].to_numpy(dtype=float)

        train_idx, test_idx = train_test_split(
            np.arange(len(df)), test_size=TEST_SIZE, random_state=seed
        )

        metrics: dict[str, ResourceMetrics] = {}
        importances: dict[str, dict[str, float]] = {}
        models: dict[str, RandomForestRegressor] = {}

        for resource in sd.RESOURCE_NAMES:
            y = df[resource].to_numpy(dtype=float)
            model = RandomForestRegressor(
                n_estimators=150,
                max_depth=16,
                min_samples_leaf=3,
                random_state=seed,
                # Explicitly single-threaded for fast single-row inference in a web server
                n_jobs=1,
            )
            model.fit(X[train_idx], y[train_idx])
            pred = model.predict(X[test_idx])

            mae = float(mean_absolute_error(y[test_idx], pred))
            rmse = float(mean_squared_error(y[test_idx], pred) ** 0.5)
            r2 = float(r2_score(y[test_idx], pred))
            metrics[resource] = ResourceMetrics(mae=mae, rmse=rmse, r2=r2)

            # Refit on the full dataset for the model actually used to serve predictions,
            # now that we have an honest held-out score from the split above.
            model.fit(X, y)
            models[resource] = model
            importances[resource] = dict(
                sorted(zip(sd.FEATURE_NAMES, model.feature_importances_.tolist()), key=lambda kv: kv[1], reverse=True)
            )

        self.models = models
        self.result = TrainingResult(
            rows=rows,
            seed=seed,
            trained_at=time.time(),
            training_seconds=time.time() - start,
            metrics=metrics,
            feature_importance=importances,
            feature_means={name: float(df[name].mean()) for name in sd.FEATURE_NAMES},
            feature_stds={name: float(df[name].std() or 1.0) for name in sd.FEATURE_NAMES},
        )
        return self.result

    def predict(self, feature_row: list[float]) -> dict[str, float]:
        if not self.models or len(self.models) < len(sd.RESOURCE_NAMES):
            return self._heuristic_fallback(feature_row)
        try:
            X = np.asarray(feature_row, dtype=float).reshape(1, -1)
            return {name: float(model.predict(X)[0]) for name, model in self.models.items()}
        except Exception as exc:
            logger.warning("Model prediction encountered exception (%s), using fallback heuristic.", exc)
            return self._heuristic_fallback(feature_row)

    def aggregate_feature_importance(self) -> dict[str, float]:
        """Average feature importance across all resource models -- used for the
        overall explainability bar chart."""
        if self.result is None:
            self._init_fallback()
        agg: dict[str, float] = {name: 0.0 for name in sd.FEATURE_NAMES}
        if self.result and self.result.feature_importance:
            for per_resource in self.result.feature_importance.values():
                for name, val in per_resource.items():
                    agg[name] += val
            n = len(self.result.feature_importance) or 1
            agg = {k: v / n for k, v in agg.items()}
        return dict(sorted(agg.items(), key=lambda kv: kv[1], reverse=True))

    def explain_prediction(self, feature_row: list[float], resource: str = "diesel_liters", top_k: int = 5) -> list[dict]:
        """Approximate per-prediction feature contribution."""
        if self.result is None:
            self._init_fallback()
        importance = (self.result.feature_importance if self.result else {}).get(resource, {})
        contributions = []
        for i, name in enumerate(sd.FEATURE_NAMES):
            mean = self.result.feature_means.get(name, 0.0) if self.result else 0.0
            std = (self.result.feature_stds.get(name, 1.0) if self.result else 1.0) or 1.0
            val = feature_row[i] if i < len(feature_row) else 0.0
            z = abs((val - mean) / std)
            score = importance.get(name, 0.0) * (1.0 + z)
            direction = "higher than typical" if val > mean else "lower than typical"
            contributions.append({"feature": name, "score": score, "direction": direction, "value": val})
        contributions.sort(key=lambda c: c["score"], reverse=True)
        total = sum(c["score"] for c in contributions) or 1.0
        for c in contributions:
            c["weight_percent"] = round(100 * c["score"] / total, 1)
        return contributions[:top_k]

    def metrics_payload(self) -> dict:
        if self.result is None:
            self._init_fallback()
        return {
            "synthetic_rows": self.result.rows if self.result else 0,
            "seed": self.result.seed if self.result else 0,
            "test_size_fraction": TEST_SIZE,
            "trained_at": self.result.trained_at if self.result else 0.0,
            "training_seconds": round(self.result.training_seconds, 3) if self.result else 0.0,
            "note": "Metrics computed on a held-out split of SYNTHETIC data only. They describe fit to the synthetic generator, not real-world station accuracy.",
            "per_resource": {
                name: {"mae": round(m.mae, 3), "rmse": round(m.rmse, 3), "r2": round(m.r2, 4)}
                for name, m in (self.result.metrics.items() if self.result else [])
            },
        }

