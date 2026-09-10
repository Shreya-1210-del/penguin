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

import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from . import synthetic_data as sd

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
        self.train(rows, seed)

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
                n_jobs=-1,
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
        X = np.asarray(feature_row, dtype=float).reshape(1, -1)
        return {name: float(model.predict(X)[0]) for name, model in self.models.items()}

    def aggregate_feature_importance(self) -> dict[str, float]:
        """Average feature importance across all resource models -- used for the
        overall explainability bar chart."""
        assert self.result is not None
        agg: dict[str, float] = {name: 0.0 for name in sd.FEATURE_NAMES}
        for per_resource in self.result.feature_importance.values():
            for name, val in per_resource.items():
                agg[name] += val
        n = len(self.result.feature_importance) or 1
        agg = {k: v / n for k, v in agg.items()}
        return dict(sorted(agg.items(), key=lambda kv: kv[1], reverse=True))

    def explain_prediction(self, feature_row: list[float], resource: str = "diesel_liters", top_k: int = 5) -> list[dict]:
        """Approximate per-prediction feature contribution.

        This is NOT SHAP / true per-tree contribution decomposition -- it is an honest,
        clearly-labelled approximation: global model feature_importances_ weighted by
        how many standard deviations the current input sits from the training-set mean
        for that feature. A feature that is both influential in general (high
        importance) AND unusual right now (high z-score) ranks at the top.
        """
        assert self.result is not None
        importance = self.result.feature_importance.get(resource, {})
        contributions = []
        for i, name in enumerate(sd.FEATURE_NAMES):
            mean = self.result.feature_means.get(name, 0.0)
            std = self.result.feature_stds.get(name, 1.0) or 1.0
            z = abs((feature_row[i] - mean) / std)
            score = importance.get(name, 0.0) * (1.0 + z)
            direction = "higher than typical" if feature_row[i] > mean else "lower than typical"
            contributions.append({"feature": name, "score": score, "direction": direction, "value": feature_row[i]})
        contributions.sort(key=lambda c: c["score"], reverse=True)
        total = sum(c["score"] for c in contributions) or 1.0
        for c in contributions:
            c["weight_percent"] = round(100 * c["score"] / total, 1)
        return contributions[:top_k]

    def metrics_payload(self) -> dict:
        assert self.result is not None
        return {
            "synthetic_rows": self.result.rows,
            "seed": self.result.seed,
            "test_size_fraction": TEST_SIZE,
            "trained_at": self.result.trained_at,
            "training_seconds": round(self.result.training_seconds, 3),
            "note": "Metrics computed on a held-out split of SYNTHETIC data only. They describe fit to the synthetic generator, not real-world station accuracy.",
            "per_resource": {
                name: {"mae": round(m.mae, 3), "rmse": round(m.rmse, 3), "r2": round(m.r2, 4)}
                for name, m in self.result.metrics.items()
            },
        }
