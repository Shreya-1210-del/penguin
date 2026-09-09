from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .physics import Scenario, Station


class PredictRequest(BaseModel):
    station: Station = "BHARATI"
    ambient_temp_c: float = Field(-25, ge=-90, le=10, description="Simulated ambient temperature, Celsius")
    habitat_temp_c: Optional[float] = Field(None, description="Optional simulated indoor habitat temperature; estimated from ambient if omitted")
    active_generators: Optional[int] = Field(None, ge=1, le=6, description="Overrides the scenario's default active generator count")
    total_generators: int = Field(3, ge=1, le=6)
    generator_efficiency_percent: float = Field(100, ge=25, le=100, description="100 = full efficiency; lower represents mechanical degradation")
    power_load_kw: float = Field(182, ge=0, le=1000)
    wind_kmh: float = Field(20, ge=0, le=200)
    personnel: int = Field(24, ge=1, le=200)
    activity_level: float = Field(0.8, ge=0.1, le=2.0)
    fuel_percent: float = Field(100, ge=0, le=100)
    scenario: Scenario = "NORMAL"
    blizzard_severity: Optional[float] = Field(None, ge=0, le=5, description="0-5; defaults based on scenario if omitted")
    planning_days: int = Field(14, ge=1, le=90)
    safety_buffer_percent: float = Field(15, ge=0, le=100)


class TrainRequest(BaseModel):
    rows: int = Field(1500, ge=300, le=10000)
    seed: int = Field(42, ge=0, le=100000)


class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class FactsQuery(BaseModel):
    category: Optional[str] = None
