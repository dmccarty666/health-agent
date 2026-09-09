"""
Apple Health -> measurements mapper.

Pure functions. No I/O. The parser (parse_apple_health.py) handles the XML
streaming; this module just maps HKQuantityTypeIdentifier strings onto the
`measurements` table columns and converts units.

The export.xml format (relevant excerpt):

    <Record type="HKQuantityTypeIdentifierBodyMass"
            sourceName="Hume Health"
            sourceVersion="3.0.0.0"
            unit="kg"
            creationDate="2026-09-08 18:35:12 -0500"
            startDate="2026-09-08 18:35:00 -0500"
            endDate="2026-09-08 18:35:00 -0500"
            value="91.36"/>

Apple Health stores each metric type as its own Record element with the same
timestamp for one weigh-in. We collect all Records sharing a measured_at
within a 5-second window and merge them into a single IngestMeasurementIn.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Tuple


# Maps Apple Health HK type -> measurements column. Anything not in this map
# is stored in raw_ble_data JSONB for later re-processing if we discover
# Hume writes more types than we expected.
HK_TYPE_TO_COLUMN: dict = {
    "HKQuantityTypeIdentifierBodyMass": "weight_kg",
    "HKQuantityTypeIdentifierBodyMassIndex": "bmi",
    "HKQuantityTypeIdentifierBodyFatPercentage": "body_fat_pct",
    "HKQuantityTypeIdentifierLeanBodyMass": "lean_mass_kg",
    "HKQuantityTypeIdentifierBasalEnergyBurned": "bmr_kcal",
}


def _to_kg(value: float, unit: str) -> Optional[float]:
    """Convert any mass unit to kilograms."""
    if unit in ("kg", ""):
        return value
    if unit == "g":
        return value / 1000.0
    if unit == "lb":
        return value / 2.20462
    if unit == "oz":
        return value / 35.274
    return None


def _to_pct(value: float, unit: str) -> Optional[float]:
    """Body fat percentage is stored 0..100 in Health, we keep it the same."""
    if unit == "%":
        return value
    if unit == "ratio":
        return value * 100.0  # 0.174 -> 17.4
    return None


def _to_count(value: float, unit: str) -> Optional[float]:
    """BMI and BMR are dimensionless / kcal - passthrough."""
    if unit in ("count", "kcal", ""):
        return value
    return None


UNIT_CONVERTERS: dict = {
    "weight_kg": _to_kg,
    "lean_mass_kg": _to_kg,
    "bmi": _to_count,
    "body_fat_pct": _to_pct,
    "bmr_kcal": _to_count,
}


def parse_hk_date(date_str: str) -> datetime:
    """Parse the Apple Health date format.

    Format: '2026-09-08 18:35:12 -0500'
    Result: timezone-aware datetime in UTC.
    """
    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S %z")
    return dt.astimezone(timezone.utc)


def map_hk_record_to_column(hk_type: str, value: float, unit: str) -> Optional[Tuple[str, float]]:
    """Map a single <Record> element to a (column, value) pair.

    Returns None if the HK type isn't one we know about OR the unit doesn't
    convert cleanly. The parser will store unmapped records in raw_ble_data.
    """
    column = HK_TYPE_TO_COLUMN.get(hk_type)
    if column is None:
        return None
    converter = UNIT_CONVERTERS.get(column)
    if converter is None:
        return None
    converted = converter(value, unit)
    if converted is None:
        return None
    return column, converted
