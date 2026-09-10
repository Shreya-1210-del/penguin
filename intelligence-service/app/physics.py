"""
Shared physical-relationship helpers for the Penguin Resource Intelligence engine.

These functions are intentionally simple, transparent formulas (not black boxes).
They are used in two places:
  1. synthetic_data.py -- to generate physically-plausible training rows
  2. main.py            -- to compute live burn-rate / survival numbers for a request

Keeping the formulas in one shared module guarantees the live prediction math and the
synthetic training data are generated from the SAME underlying relationships, which is
what makes the RandomForest model able to learn something meaningful from them.

IMPORTANT: none of these numbers are real Bharati/Maitri operational figures. They are
prototype constants chosen to be "physically reasonable" for demonstration purposes only.
"""
from __future__ import annotations

from typing import Literal

SCENARIOS = ["NORMAL", "BLIZZARD", "GENERATOR_FAILURE", "COMBINED", "HIGH_LOAD"]
Scenario = Literal["NORMAL", "BLIZZARD", "GENERATOR_FAILURE", "COMBINED", "HIGH_LOAD"]

STATIONS = ["BHARATI", "MAITRI"]
Station = Literal["BHARATI", "MAITRI"]

# Prototype baseline constants (SYNTHETIC, not real station specifications)
BASE_FUEL_LITERS = 120_000.0
BASE_BURN_LPH_PER_GENERATOR = 45.0
MAX_KW_PER_GENERATOR = 120.0
TOTAL_GENERATORS = 3

# Station reference data as documented in the supplied project material only.
STATION_INFO = {
    "BHARATI": {
        "coordinates": "69°24′ S / 76°11′ E",
        "avg_temp_offset_c": 3.0,   # Bharati (coastal) runs a little milder in the prototype model
        "personnel_bias": 0,
    },
    "MAITRI": {
        "coordinates": "70°45′ S / 11°44′ E",
        "avg_temp_offset_c": -3.0,  # Maitri modeled slightly colder on average in the prototype
        "personnel_bias": -2,
    },
}

SCENARIO_MULTIPLIER = {
    "NORMAL": 1.0,
    "BLIZZARD": 1.0,
    "GENERATOR_FAILURE": 1.0,
    "COMBINED": 1.0,
    # HIGH_LOAD has no severity slider or generator loss of its own, so it gets a direct
    # multiplier. Every other scenario's effect comes through blizzard_severity and/or
    # load_share_penalty below, so they are NOT double-counted here.
    "HIGH_LOAD": 1.35,
}

SCENARIO_EMERGENCY_LEVEL = {
    "NORMAL": 0,
    "BLIZZARD": 4,
    "GENERATOR_FAILURE": 4,
    "COMBINED": 5,
    "HIGH_LOAD": 2,
}

# Generators considered "active" once a scenario knocks some offline, absent an explicit override
SCENARIO_GENERATOR_LOSS = {
    "NORMAL": 0,
    "BLIZZARD": 0,
    "GENERATOR_FAILURE": 2,
    "COMBINED": 2,
    "HIGH_LOAD": 0,
}

# Default blizzard severity (0-5) implied by a scenario, when the caller does not set one explicitly
SCENARIO_DEFAULT_BLIZZARD_SEVERITY = {
    "NORMAL": 0.0,
    "BLIZZARD": 4.0,
    "GENERATOR_FAILURE": 0.0,
    "COMBINED": 4.0,
    "HIGH_LOAD": 0.0,
}


def cold_multiplier(temp_c: float) -> float:
    """Fuel burn rises once ambient temperature drops below -20C (documented prototype threshold)."""
    return 1.0 + (abs(temp_c) - 20.0) * 0.018 if temp_c < -20 else 1.0


def blizzard_multiplier(severity: float) -> float:
    """Extra burn caused by wind-driven heat loss and reduced generator intake efficiency."""
    severity = max(0.0, min(5.0, severity))
    return 1.0 + severity * 0.09


def efficiency_multiplier(generator_efficiency_percent: float) -> float:
    """A degraded generator burns proportionally more fuel per kWh delivered."""
    eff = max(25.0, min(100.0, generator_efficiency_percent))
    return 100.0 / eff


def load_share_penalty(total_generators: int, active_generators: int) -> float:
    """When fewer generators are active, the station's total power demand doesn't shrink --
    the remaining generators must cover more of it each, at a fuel-efficiency cost. This is
    what makes GENERATOR_FAILURE more expensive than simply "burn scales with generator count"
    would suggest."""
    active = max(1, active_generators)
    total = max(1, total_generators)
    return (total / active) ** 0.85


def scenario_multiplier(scenario: str) -> float:
    return SCENARIO_MULTIPLIER.get(scenario, 1.0)


def emergency_level(scenario: str) -> int:
    return SCENARIO_EMERGENCY_LEVEL.get(scenario, 0)


def effective_burn(
    temp_c: float,
    active_generators: int,
    scenario: str,
    generator_efficiency_percent: float = 100.0,
    blizzard_severity: float | None = None,
    total_generators: int = TOTAL_GENERATORS,
) -> float:
    """Litres/hour of diesel burned across all active generators under the given conditions.

    Base term uses total_generators (the station's full-capacity fuel need), then
    load_share_penalty inflates that when fewer generators are actually active --
    modeling the remaining units working harder to cover the same station load.
    """
    severity = SCENARIO_DEFAULT_BLIZZARD_SEVERITY.get(scenario, 0.0) if blizzard_severity is None else blizzard_severity
    return (
        BASE_BURN_LPH_PER_GENERATOR
        * max(total_generators, 1)
        * cold_multiplier(temp_c)
        * scenario_multiplier(scenario)
        * blizzard_multiplier(severity)
        * efficiency_multiplier(generator_efficiency_percent)
        * load_share_penalty(total_generators, active_generators)
    )


def station_fuel_capacity(station: str) -> float:
    # Prototype simplification: both stations share the same nominal tank capacity constant.
    return BASE_FUEL_LITERS


def resolve_active_generators(total_generators: int, scenario: str, override: int | None) -> int:
    if override is not None:
        return max(1, min(total_generators, override))
    loss = SCENARIO_GENERATOR_LOSS.get(scenario, 0)
    return max(1, total_generators - loss)
