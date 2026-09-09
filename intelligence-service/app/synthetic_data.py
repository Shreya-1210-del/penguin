"""
SYNTHETIC PROTOTYPE DATA GENERATOR
-----------------------------------
Penguin does not have access to real Bharati/Maitri telemetry (it is not publicly
available), so the Resource Intelligence model is trained entirely on synthetic
operating states generated here.

Every row is sampled from one of ten named regimes so the dataset covers realistic
operational variety rather than pure random noise. Targets (resource consumption)
are then derived from the SAME physical relationships used at inference time
(see physics.py), plus a small amount of Gaussian noise, so the model is learning a
noisy-but-real function instead of memorizing arbitrary numbers.

Reproducibility: pass a numpy Generator seeded from an integer seed. The same seed
+ row count always produces the same dataset, which is what makes a hackathon demo
repeatable.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import physics

FEATURE_NAMES = [
    "ambient_temp_c",
    "habitat_temp_c",
    "active_generators",
    "generator_efficiency_percent",
    "power_load_kw",
    "wind_kmh",
    "personnel",
    "activity_level",
    "fuel_percent",
    "emergency_level",
    "blizzard_severity",
    "planning_days",
    "station_is_maitri",
]

RESOURCE_NAMES = ["diesel_liters", "power_kwh", "ration_packs", "medical_kits", "critical_spares"]

REGIME_NAMES = [
    "normal_operations",
    "cold_conditions",
    "severe_cold",
    "blizzard",
    "generator_degradation",
    "generator_failure",
    "high_consumption",
    "low_consumption",
    "changing_station_load",
    "recovery_after_emergency",
]

# Sampling weight for each regime -- keeps "normal" the most common state, as on a real station,
# while still giving the model plenty of emergency/edge-case examples to learn from.
REGIME_WEIGHTS = [0.26, 0.14, 0.07, 0.10, 0.08, 0.08, 0.09, 0.06, 0.07, 0.05]


@dataclass
class SampledState:
    station: str
    ambient_temp_c: float
    active_generators: int
    generator_efficiency_percent: float
    power_load_kw: float
    wind_kmh: float
    personnel: int
    activity_level: float
    fuel_percent: float
    scenario: str
    blizzard_severity: float
    planning_days: int
    regime: str


def _sample_regime(rng: np.random.Generator, regime: str, station: str) -> SampledState:
    station_offset = physics.STATION_INFO[station]["avg_temp_offset_c"]
    personnel_bias = physics.STATION_INFO[station]["personnel_bias"]
    total_gen = physics.TOTAL_GENERATORS

    if regime == "normal_operations":
        temp = rng.uniform(-28, -18) + station_offset
        generators, efficiency, scenario, severity = total_gen, rng.uniform(92, 100), "NORMAL", 0.0
        wind = rng.uniform(5, 25)
    elif regime == "cold_conditions":
        temp = rng.uniform(-38, -28) + station_offset
        generators, efficiency, scenario, severity = total_gen, rng.uniform(88, 99), "NORMAL", 0.0
        wind = rng.uniform(10, 35)
    elif regime == "severe_cold":
        temp = rng.uniform(-55, -40) + station_offset
        generators, efficiency, scenario, severity = total_gen, rng.uniform(85, 97), "NORMAL", 0.0
        wind = rng.uniform(15, 45)
    elif regime == "blizzard":
        temp = rng.uniform(-50, -30) + station_offset
        generators, efficiency = total_gen, rng.uniform(80, 96)
        scenario, severity = "BLIZZARD", rng.uniform(2.5, 5.0)
        wind = rng.uniform(45, 95)
    elif regime == "generator_degradation":
        temp = rng.uniform(-40, -20) + station_offset
        generators, efficiency = total_gen, rng.uniform(45, 78)
        scenario, severity = "NORMAL", 0.0
        wind = rng.uniform(5, 30)
    elif regime == "generator_failure":
        temp = rng.uniform(-45, -20) + station_offset
        generators = int(rng.choice([1, 2], p=[0.55, 0.45]))
        efficiency = rng.uniform(60, 95)
        scenario, severity = "GENERATOR_FAILURE", 0.0
        wind = rng.uniform(5, 40)
    elif regime == "high_consumption":
        temp = rng.uniform(-35, -18) + station_offset
        generators, efficiency = total_gen, rng.uniform(88, 100)
        scenario, severity = "HIGH_LOAD", rng.uniform(0, 1.0)
        wind = rng.uniform(5, 30)
    elif regime == "low_consumption":
        temp = rng.uniform(-22, -15) + station_offset
        generators, efficiency = max(1, total_gen - 1), rng.uniform(90, 100)
        scenario, severity = "NORMAL", 0.0
        wind = rng.uniform(2, 15)
    elif regime == "changing_station_load":
        temp = rng.uniform(-32, -18) + station_offset
        generators, efficiency = total_gen, rng.uniform(85, 100)
        scenario, severity = "NORMAL", 0.0
        wind = rng.uniform(5, 35)
    else:  # recovery_after_emergency
        temp = rng.uniform(-35, -20) + station_offset
        generators, efficiency = total_gen, rng.uniform(75, 92)
        scenario, severity = "NORMAL", 0.0
        wind = rng.uniform(10, 30)

    personnel = int(np.clip(rng.integers(10, 40) + personnel_bias, 6, 45))
    activity = {
        "high_consumption": rng.uniform(1.0, 1.5),
        "low_consumption": rng.uniform(0.35, 0.65),
        "changing_station_load": rng.uniform(0.5, 1.4),
    }.get(regime, rng.uniform(0.6, 1.05))

    power = float(np.clip(rng.normal(180 + max(-temp - 25, 0) * 3 + (activity - 0.8) * 60, 45), 60, 380))
    fuel_pct = float(rng.uniform(6, 100)) if regime != "recovery_after_emergency" else float(rng.uniform(35, 75))
    planning_days = int(rng.integers(1, 31))

    return SampledState(
        station=station,
        ambient_temp_c=float(temp),
        active_generators=generators,
        generator_efficiency_percent=float(efficiency),
        power_load_kw=power,
        wind_kmh=float(wind),
        personnel=personnel,
        activity_level=float(activity),
        fuel_percent=fuel_pct,
        scenario=scenario,
        blizzard_severity=float(severity),
        planning_days=planning_days,
        regime=regime,
    )


def _targets_for_state(state: SampledState, rng: np.random.Generator) -> dict[str, float]:
    burn = physics.effective_burn(
        state.ambient_temp_c,
        state.active_generators,
        state.scenario,
        state.generator_efficiency_percent,
        state.blizzard_severity,
        total_generators=physics.TOTAL_GENERATORS,
    )
    level = physics.emergency_level(state.scenario)
    cold_stress = max(0.0, -state.ambient_temp_c - 20) / 35
    wind_stress = max(0.0, state.wind_kmh - 30) / 60
    demand_factor = (
        1
        + 0.20 * cold_stress
        + 0.12 * wind_stress
        + 0.018 * state.personnel
        + 0.22 * max(state.activity_level - 0.8, 0)
        + 0.10 * level
        + 0.05 * (state.blizzard_severity / 5.0)
    )

    diesel = burn * 24 * state.planning_days * demand_factor * rng.normal(1.0, 0.035)
    power = max(
        0.0,
        state.power_load_kw
        * 24
        * state.planning_days
        * (1 + 0.25 * cold_stress + 0.10 * wind_stress)
        * rng.normal(1.0, 0.04),
    )
    rations = max(
        1.0,
        state.personnel * state.planning_days * (1 + 0.12 * max(state.activity_level - 0.8, 0)) * (1 + 0.05 * level),
    ) * rng.normal(1.0, 0.02)
    medical = max(
        1.0,
        math.ceil(state.personnel * state.planning_days / 14 * (1 + 0.25 * level + 0.08 * cold_stress)),
    ) * rng.normal(1.0, 0.05)
    spares = max(
        1.0,
        0.7
        + 0.35 * (physics.TOTAL_GENERATORS - state.active_generators)
        + 0.45 * level
        + 0.12 * wind_stress
        + 0.08 * cold_stress
        + 0.30 * max(0.0, (100 - state.generator_efficiency_percent) / 100),
    ) * rng.normal(1.0, 0.05)

    return {
        "diesel_liters": max(0.0, diesel),
        "power_kwh": max(0.0, power),
        "ration_packs": max(0.0, rations),
        "medical_kits": max(0.0, medical),
        "critical_spares": max(0.0, spares),
    }


def state_to_feature_row(state: SampledState) -> list[float]:
    return [
        state.ambient_temp_c,
        state.ambient_temp_c + 18.0,  # habitat_temp_c: prototype assumption, insulated ~18C above ambient
        state.active_generators,
        state.generator_efficiency_percent,
        state.power_load_kw,
        state.wind_kmh,
        state.personnel,
        state.activity_level,
        state.fuel_percent,
        physics.emergency_level(state.scenario),
        state.blizzard_severity,
        state.planning_days,
        1.0 if state.station == "MAITRI" else 0.0,
    ]


def generate_dataset(rows: int = 1500, seed: int = 42) -> pd.DataFrame:
    """Generate a reproducible synthetic training dataset as a pandas DataFrame.

    Columns: FEATURE_NAMES + RESOURCE_NAMES + ['regime', 'station', 'scenario']
    """
    rng = np.random.default_rng(seed)
    records: list[dict] = []
    for _ in range(rows):
        regime = rng.choice(REGIME_NAMES, p=REGIME_WEIGHTS)
        station = rng.choice(physics.STATIONS)
        state = _sample_regime(rng, str(regime), str(station))
        targets = _targets_for_state(state, rng)
        row = dict(zip(FEATURE_NAMES, state_to_feature_row(state)))
        row.update(targets)
        row["regime"] = state.regime
        row["station"] = state.station
        row["scenario"] = state.scenario
        records.append(row)
    return pd.DataFrame.from_records(records)
