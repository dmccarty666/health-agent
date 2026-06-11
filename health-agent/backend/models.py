"""Pydantic response models for the health-agent API.

Covers all 39 measurement data fields plus metadata columns (id, user_id,
measured_at, device_name, note) from the measurements table, plus user
profile fields.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Measurement response — all 39 body composition fields + 5 metadata fields
# ---------------------------------------------------------------------------

class MeasurementOut(BaseModel):
    """Full measurement record as returned by the API."""

    # Metadata
    id: str
    user_id: str
    measured_at: datetime
    device_name: Optional[str] = None
    note: Optional[str] = None

    # Core
    weight_kg: Optional[Decimal] = None
    bmi: Optional[Decimal] = None

    # Body fat
    body_fat_pct: Optional[Decimal] = None
    fat_mass_kg: Optional[Decimal] = None
    subcut_fat_kg: Optional[Decimal] = None
    subcut_fat_pct: Optional[Decimal] = None
    visceral_fat: Optional[Decimal] = None
    android_fat_kg: Optional[Decimal] = None
    gynoid_fat_kg: Optional[Decimal] = None
    ag_ratio_pct: Optional[Decimal] = None

    # Lean & muscle
    lean_mass_kg: Optional[Decimal] = None
    lean_mass_pct: Optional[Decimal] = None
    skel_muscle_kg: Optional[Decimal] = None
    body_cell_mass_kg: Optional[Decimal] = None

    # Water
    body_water_pct: Optional[Decimal] = None
    total_water_kg: Optional[Decimal] = None
    ecw_kg: Optional[Decimal] = None
    icw_kg: Optional[Decimal] = None

    # Bone & mineral
    bone_mineral_kg: Optional[Decimal] = None
    mineral_mass_kg: Optional[Decimal] = None

    # Other composition
    skeletal_mass_kg: Optional[Decimal] = None
    organ_mass_kg: Optional[Decimal] = None

    # Metabolic
    bmr_kcal: Optional[Decimal] = None
    metabolic_age: Optional[int] = None

    # Segmental — right arm
    seg_right_arm_muscle_kg: Optional[Decimal] = None
    seg_right_arm_fat_pct: Optional[Decimal] = None
    seg_right_arm_fat_kg: Optional[Decimal] = None

    # Segmental — left arm
    seg_left_arm_muscle_kg: Optional[Decimal] = None
    seg_left_arm_fat_pct: Optional[Decimal] = None
    seg_left_arm_fat_kg: Optional[Decimal] = None

    # Segmental — trunk
    seg_trunk_muscle_kg: Optional[Decimal] = None
    seg_trunk_fat_pct: Optional[Decimal] = None
    seg_trunk_fat_kg: Optional[Decimal] = None

    # Segmental — right leg
    seg_right_leg_muscle_kg: Optional[Decimal] = None
    seg_right_leg_fat_pct: Optional[Decimal] = None
    seg_right_leg_fat_kg: Optional[Decimal] = None

    # Segmental — left leg
    seg_left_leg_muscle_kg: Optional[Decimal] = None
    seg_left_leg_fat_pct: Optional[Decimal] = None
    seg_left_leg_fat_kg: Optional[Decimal] = None

    model_config = {"from_attributes": True, "json_encoders": {Decimal: lambda v: float(v) if v is not None else None}}


# ---------------------------------------------------------------------------
# Profile response
# ---------------------------------------------------------------------------

class ProfileOut(BaseModel):
    """User profile information."""

    id: str
    name: str
    email: str
    sex: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[Decimal] = None
    activity_level: Optional[str] = None
    unit_preference: Optional[str] = None
    measurement_count: int = 0
    latest_measurement_at: Optional[datetime] = None

    model_config = {"from_attributes": True, "json_encoders": {Decimal: lambda v: float(v) if v is not None else None}}


# ---------------------------------------------------------------------------
# Trend data point
# ---------------------------------------------------------------------------

class TrendPoint(BaseModel):
    """A single data point in a trend series."""

    measured_at: datetime
    metrics: dict = Field(default_factory=dict, description="Metric name -> value")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class HealthzOut(BaseModel):
    """Health-check response."""
    status: str = "ok"
    database: str = "connected"
    measurement_count: int = 0


# ---------------------------------------------------------------------------
# Ingest — POST /api/ingest/measurement
# ---------------------------------------------------------------------------
#
# The Pi BLE listener (or any other local data source) posts a full body
# composition record here. Schema matches MeasurementOut, minus the server-
# assigned fields (id, user_id). The route is HMAC-authenticated via headers.
# ---------------------------------------------------------------------------

class IngestMeasurementIn(BaseModel):
    """Payload posted by a local data source (Pi BLE listener, manual entry, etc.)."""

    measured_at: datetime
    device_name: Optional[str] = None
    note: Optional[str] = None

    # All 39 body composition fields — same as MeasurementOut, all optional
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    body_fat_pct: Optional[float] = None
    fat_mass_kg: Optional[float] = None
    subcut_fat_kg: Optional[float] = None
    subcut_fat_pct: Optional[float] = None
    visceral_fat: Optional[float] = None
    android_fat_kg: Optional[float] = None
    gynoid_fat_kg: Optional[float] = None
    ag_ratio_pct: Optional[float] = None
    lean_mass_kg: Optional[float] = None
    lean_mass_pct: Optional[float] = None
    skel_muscle_kg: Optional[float] = None
    body_cell_mass_kg: Optional[float] = None
    body_water_pct: Optional[float] = None
    total_water_kg: Optional[float] = None
    ecw_kg: Optional[float] = None
    icw_kg: Optional[float] = None
    bone_mineral_kg: Optional[float] = None
    mineral_mass_kg: Optional[float] = None
    skeletal_mass_kg: Optional[float] = None
    organ_mass_kg: Optional[float] = None
    bmr_kcal: Optional[float] = None
    metabolic_age: Optional[int] = None
    seg_right_arm_muscle_kg: Optional[float] = None
    seg_right_arm_fat_pct: Optional[float] = None
    seg_right_arm_fat_kg: Optional[float] = None
    seg_left_arm_muscle_kg: Optional[float] = None
    seg_left_arm_fat_pct: Optional[float] = None
    seg_left_arm_fat_kg: Optional[float] = None
    seg_trunk_muscle_kg: Optional[float] = None
    seg_trunk_fat_pct: Optional[float] = None
    seg_trunk_fat_kg: Optional[float] = None
    seg_right_leg_muscle_kg: Optional[float] = None
    seg_right_leg_fat_pct: Optional[float] = None
    seg_right_leg_fat_kg: Optional[float] = None
    seg_left_leg_muscle_kg: Optional[float] = None
    seg_left_leg_fat_pct: Optional[float] = None
    seg_left_leg_fat_kg: Optional[float] = None


class IngestOut(BaseModel):
    """Response from a successful ingest."""
    status: str = "ok"
    action: str  # "inserted" | "updated"
    measured_at: datetime
    device_name: Optional[str] = None
    measurement_count: int = 0
