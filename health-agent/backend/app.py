"""FastAPI application — health-agent backend API.

Entry point for the body composition data API. Serves measurement records,
trends, user profile, and health-check endpoints from the PostgreSQL
health_agent database.

Start with:
    uvicorn app:app --host 0.0.0.0 --port 8765
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from db import get_cursor, get_user_id
from models import (
    HealthzOut,
    IngestMeasurementIn,
    IngestOut,
    MeasurementOut,
    ProfileOut,
    TrendPoint,
)

# ── All valid measurement metric column names ──────────────────────────
ALL_METRIC_COLUMNS = frozenset(
    {
        "weight_kg",
        "bmi",
        "body_fat_pct",
        "fat_mass_kg",
        "subcut_fat_kg",
        "subcut_fat_pct",
        "visceral_fat",
        "android_fat_kg",
        "gynoid_fat_kg",
        "ag_ratio_pct",
        "lean_mass_kg",
        "lean_mass_pct",
        "skel_muscle_kg",
        "body_cell_mass_kg",
        "body_water_pct",
        "total_water_kg",
        "ecw_kg",
        "icw_kg",
        "bone_mineral_kg",
        "mineral_mass_kg",
        "skeletal_mass_kg",
        "organ_mass_kg",
        "bmr_kcal",
        "metabolic_age",
        "seg_right_arm_muscle_kg",
        "seg_right_arm_fat_pct",
        "seg_right_arm_fat_kg",
        "seg_left_arm_muscle_kg",
        "seg_left_arm_fat_pct",
        "seg_left_arm_fat_kg",
        "seg_trunk_muscle_kg",
        "seg_trunk_fat_pct",
        "seg_trunk_fat_kg",
        "seg_right_leg_muscle_kg",
        "seg_right_leg_fat_pct",
        "seg_right_leg_fat_kg",
        "seg_left_leg_muscle_kg",
        "seg_left_leg_fat_pct",
        "seg_left_leg_fat_kg",
    }
)

# ── Application ────────────────────────────────────────────────────────

app = FastAPI(title="Health Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── GET /api/health/healthz ────────────────────────────────────────────


@app.get("/api/health/healthz", response_model=HealthzOut)
def healthz() -> HealthzOut:
    """Health check — verifies database connectivity."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM measurements")
            row = cur.fetchone()
            count = row["cnt"] if row else 0
        return HealthzOut(database="connected", measurement_count=count)
    except Exception as exc:
        return HealthzOut(status="degraded", database=str(exc), measurement_count=0)


# ── GET /api/health/profile ────────────────────────────────────────────


@app.get("/api/health/profile", response_model=ProfileOut)
def profile() -> ProfileOut:
    """Return the active user profile with measurement stats."""
    uid = get_user_id()
    if not uid:
        raise HTTPException(status_code=404, detail="No user found")

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                u.id, u.name, u.email, u.sex, u.age, u.height_cm,
                u.activity_level, u.unit_preference,
                COUNT(m.id)                 AS measurement_count,
                MAX(m.measured_at)          AS latest_measurement_at
            FROM users u
            LEFT JOIN measurements m ON m.user_id = u.id
            WHERE u.id = %s
            GROUP BY u.id
            """,
            (uid,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

    return ProfileOut(**row)


# ── GET /api/health/measurements ───────────────────────────────────────


@app.get("/api/health/measurements", response_model=list[MeasurementOut])
def list_measurements(limit: int = Query(default=30, ge=1, le=200)) -> list[MeasurementOut]:
    """Return the most recent measurements, newest first."""
    uid = get_user_id()

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, measured_at, device_name, note,
                   weight_kg, bmi, body_fat_pct, fat_mass_kg,
                   subcut_fat_kg, subcut_fat_pct, visceral_fat,
                   android_fat_kg, gynoid_fat_kg, ag_ratio_pct,
                   lean_mass_kg, lean_mass_pct, skel_muscle_kg,
                   body_cell_mass_kg, body_water_pct, total_water_kg,
                   ecw_kg, icw_kg, bone_mineral_kg, mineral_mass_kg,
                   skeletal_mass_kg, organ_mass_kg, bmr_kcal, metabolic_age,
                   seg_right_arm_muscle_kg, seg_right_arm_fat_pct,
                   seg_right_arm_fat_kg,
                   seg_left_arm_muscle_kg, seg_left_arm_fat_pct,
                   seg_left_arm_fat_kg,
                   seg_trunk_muscle_kg, seg_trunk_fat_pct, seg_trunk_fat_kg,
                   seg_right_leg_muscle_kg, seg_right_leg_fat_pct,
                   seg_right_leg_fat_kg,
                   seg_left_leg_muscle_kg, seg_left_leg_fat_pct,
                   seg_left_leg_fat_kg
            FROM measurements
            WHERE user_id = %s
            ORDER BY measured_at DESC
            LIMIT %s
            """,
            (uid, limit),
        )
        rows = cur.fetchall()

    return [MeasurementOut(**row) for row in rows]


# ── GET /api/health/measurements/latest ────────────────────────────────


@app.get("/api/health/measurements/latest", response_model=MeasurementOut)
def latest_measurement() -> MeasurementOut:
    """Return the single most recent measurement."""
    uid = get_user_id()

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, measured_at, device_name, note,
                   weight_kg, bmi, body_fat_pct, fat_mass_kg,
                   subcut_fat_kg, subcut_fat_pct, visceral_fat,
                   android_fat_kg, gynoid_fat_kg, ag_ratio_pct,
                   lean_mass_kg, lean_mass_pct, skel_muscle_kg,
                   body_cell_mass_kg, body_water_pct, total_water_kg,
                   ecw_kg, icw_kg, bone_mineral_kg, mineral_mass_kg,
                   skeletal_mass_kg, organ_mass_kg, bmr_kcal, metabolic_age,
                   seg_right_arm_muscle_kg, seg_right_arm_fat_pct,
                   seg_right_arm_fat_kg,
                   seg_left_arm_muscle_kg, seg_left_arm_fat_pct,
                   seg_left_arm_fat_kg,
                   seg_trunk_muscle_kg, seg_trunk_fat_pct, seg_trunk_fat_kg,
                   seg_right_leg_muscle_kg, seg_right_leg_fat_pct,
                   seg_right_leg_fat_kg,
                   seg_left_leg_muscle_kg, seg_left_leg_fat_pct,
                   seg_left_leg_fat_kg
            FROM measurements
            WHERE user_id = %s
            ORDER BY measured_at DESC
            LIMIT 1
            """,
            (uid,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No measurements found")

    return MeasurementOut(**row)


# ── GET /api/health/measurements/trends ────────────────────────────────


@app.get("/api/health/measurements/trends", response_model=list[TrendPoint])
def measurement_trends(
    metrics: str = Query(
        default="weight_kg,bmi",
        description="Comma-separated metric column names",
    ),
    days: int | None = Query(
        default=None,
        ge=1,
        le=730,
        description="Restrict to last N days (optional). Mutually exclusive with `since`.",
    ),
    since: str | None = Query(
        default=None,
        description="ISO date (YYYY-MM-DD) — return rows on/after this date. Optional.",
    ),
    limit: int = Query(default=90, ge=1, le=366),
) -> list[TrendPoint]:
    """Return selected metrics over time, oldest first.

    Query params:
        metrics: comma-separated column names (e.g. "weight_kg,bmi,body_fat_pct")
        days:    optional — restrict to last N days
        since:   optional — ISO date (YYYY-MM-DD) for custom lower bound
        limit:   max number of data points (default 90)

    The query uses the standard "most recent N, chronologically ordered" subquery
    pattern. Without this, ``ORDER BY ASC LIMIT N`` returns the OLDEST N rows.
    """
    if days is not None and since is not None:
        raise HTTPException(
            status_code=400,
            detail="`days` and `since` are mutually exclusive — pick one",
        )

    uid = get_user_id()

    # Parse and validate requested metrics
    requested = [m.strip() for m in metrics.split(",") if m.strip()]
    if not requested:
        raise HTTPException(status_code=400, detail="At least one metric required")

    invalid = [m for m in requested if m not in ALL_METRIC_COLUMNS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric(s): {', '.join(invalid)}",
        )

    # Build the column list safely — all columns are in our allowlist
    columns_sql = ", ".join(requested)

    # Build optional date filter and params
    if days is not None:
        date_filter = "AND measured_at >= NOW() - make_interval(days => %s)"
        date_params: tuple = (days,)
    elif since is not None:
        date_filter = "AND measured_at >= %s"
        date_params = (since,)
    else:
        date_filter = ""
        date_params = ()

    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT measured_at, {columns_sql}
            FROM (
                SELECT measured_at, {columns_sql}
                FROM measurements
                WHERE user_id = %s
                  {date_filter}
                ORDER BY measured_at DESC
                LIMIT %s
            ) recent
            ORDER BY measured_at ASC
            """,
            (uid, *date_params, limit),
        )
        rows = cur.fetchall()

    result: list[TrendPoint] = []
    for row in rows:
        metrics_dict = {}
        for col in requested:
            val = row[col]
            # Convert Decimal to float for clean JSON serialisation
            if hasattr(val, "__float__"):
                val = float(val)
            metrics_dict[col] = val
        result.append(
            TrendPoint(measured_at=row["measured_at"], metrics=metrics_dict)
        )

    return result


# ───────────────────────────────────────────────────────────────────────────
# INGEST — POST /api/ingest/measurement
#
# Receives body composition records from local data sources (the Pi BLE
# listener, manual entry, etc.). HMAC-authenticated so random LAN clients
# can't spam the database.
#
# Auth scheme:
#   Headers:
#     X-Scale-Timestamp:  Unix epoch seconds, must be within ±300s of now
#     X-Scale-Signature:  hex(HMAC-SHA256(secret, timestamp + "." + raw_body))
#   Secret: SCALE_INGEST_SECRET env var, or hardcoded default for local dev.
#   Replay protection: timestamp must be recent.
# ───────────────────────────────────────────────────────────────────────────

INGEST_SECRET = os.environ.get("SCALE_INGEST_SECRET", "dev-secret-change-me")
INGEST_TIMESTAMP_TOLERANCE = 300  # ±5 minutes


def _verify_ingest_signature(secret: str, timestamp: str, signature: str, raw_body: bytes) -> bool:
    """Constant-time HMAC verification. Returns True if signature is valid."""
    if not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    # Replay protection: timestamp must be within tolerance of now
    if abs(time.time() - ts) > INGEST_TIMESTAMP_TOLERANCE:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.post("/api/ingest/measurement", response_model=IngestOut)
async def ingest_measurement(
    payload: IngestMeasurementIn,
    request: Request,
    x_scale_timestamp: Optional[str] = Header(None, alias="X-Scale-Timestamp"),
    x_scale_signature: Optional[str] = Header(None, alias="X-Scale-Signature"),
) -> IngestOut:
    """Accept a body composition record from a local authenticated source.

    The Pi BLE listener will POST one of these after each successful
    weigh-in. We UPSERT by (user_id, measured_at) so re-runs are idempotent.
    """
    # HMAC verification — read raw body BEFORE Pydantic consumes it so the
    # signature covers the exact bytes the client sent.
    raw_body = await request.body()
    if not _verify_ingest_signature(INGEST_SECRET, x_scale_timestamp or "", x_scale_signature or "", raw_body):
        raise HTTPException(status_code=401, detail="Invalid or missing signature")

    uid = get_user_id()
    if not uid:
        raise HTTPException(status_code=503, detail="No user configured in database")

    # Build UPSERT — same pattern as fixed sync_hume.py
    payload_dict = payload.model_dump()
    columns = ["id", "user_id", "measured_at", "device_name", "note"] + sorted(ALL_METRIC_COLUMNS)
    update_cols = [c for c in columns if c not in ("id", "user_id", "measured_at")]
    update_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    # Order the values to match `columns` exactly
    row = (
        str(uuid.uuid4()),
        uid,
        payload_dict["measured_at"],
        payload_dict.get("device_name"),
        payload_dict.get("note"),
    ) + tuple(payload_dict.get(col) for col in sorted(ALL_METRIC_COLUMNS))

    with get_cursor() as cur:
        # First check if this (user_id, measured_at) exists so we can report
        # inserted vs updated in the response.
        cur.execute(
            "SELECT 1 FROM measurements WHERE user_id = %s AND measured_at = %s",
            (uid, payload_dict["measured_at"]),
        )
        existed = cur.fetchone() is not None

        cur.execute(
            f"""
            INSERT INTO measurements ({', '.join(columns)})
            VALUES ({', '.join(['%s'] * len(columns))})
            ON CONFLICT (user_id, measured_at) DO UPDATE
            SET {update_sql}
            """,
            row,
        )
        cur.execute("SELECT COUNT(*) AS n FROM measurements WHERE user_id = %s", (uid,))
        count_row = cur.fetchone()
        total = count_row["n"] if count_row else 0

    return IngestOut(
        status="ok",
        action="updated" if existed else "inserted",
        measured_at=payload_dict["measured_at"],
        device_name=payload_dict.get("device_name"),
        measurement_count=total,
    )
