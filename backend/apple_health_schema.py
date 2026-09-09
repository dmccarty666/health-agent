"""
Pydantic models for Apple Health ingest endpoints.

Two distinct shapes:
1. HealthSaveBatchIn - what HealthSave iOS app sends to the IONOS relay
   (which then forwards to AIDEV). See docs/apple-health-ingest.md §"HealthSave
   wire format".

2. AppleHealthSampleIn - what the historical XML parser sends to AIDEV
   directly. Same shape as IngestMeasurementIn but with source='apple_health'
   and the additional raw_ble_data column populated.

Why two models:
   HealthSave batches many small samples (one per metric per timestamp),
   while the XML parser already groups by timestamp into a single payload.
   The IONOS relay collapses the batch into grouped payloads before
   forwarding, so /api/ingest/apple_health only ever sees the grouped form.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HealthSaveSample(BaseModel):
    """A single sample from HealthSave's batch payload."""
    metric: str
    unit: str
    value: float
    timestamp: datetime
    source: str = "Hume Health"
    device: Optional[str] = None


class HealthSaveBatchIn(BaseModel):
    """Payload HealthSave iOS app POSTs to /api/apple/batch."""
    api_key: str
    batch: List[HealthSaveSample] = Field(default_factory=list)


class AppleHealthSampleIn(BaseModel):
    """Single weigh-in payload as built by scripts/parse_apple_health.py.

    Same field set as IngestMeasurementIn but with `source` and `raw_ble_data`
    populated. Stored with source='apple_health' so we can distinguish from
    bridge rows.
    """
    measured_at: datetime
    device_name: Optional[str] = None
    note: Optional[str] = None
    source: str = "apple_health"

    # The 5 fields Apple Health actually carries for body composition
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    body_fat_pct: Optional[float] = None
    lean_mass_kg: Optional[float] = None
    bmr_kcal: Optional[float] = None

    # Everything else is optional and likely null - Hume doesn't write these
    fat_mass_kg: Optional[float] = None
    subcut_fat_kg: Optional[float] = None
    subcut_fat_pct: Optional[float] = None
    visceral_fat: Optional[float] = None
    android_fat_kg: Optional[float] = None
    gynoid_fat_kg: Optional[float] = None
    ag_ratio_pct: Optional[float] = None
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

    # raw_ble_data JSONB column - stores unmapped HK records for future
    # re-processing. None when the parser found no extra Hume records.
    raw_ble_data: Optional[dict] = None
