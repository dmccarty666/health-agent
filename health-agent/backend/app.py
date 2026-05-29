"""FastAPI application — health-agent backend API.

Entry point for the body composition data API. Serves measurement records,
trends, user profile, and health-check endpoints from the PostgreSQL
health_agent database.

Start with:
    uvicorn app:app --host 0.0.0.0 --port 8765
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from db import get_cursor, get_user_id
from models import HealthzOut, MeasurementOut, ProfileOut, TrendPoint

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
    limit: int = Query(default=90, ge=1, le=366),
) -> list[TrendPoint]:
    """Return selected metrics over time, oldest first.

    Query params:
        metrics: comma-separated column names (e.g. "weight_kg,bmi,body_fat_pct")
        limit:   max number of data points (default 90)
    """
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

    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT measured_at, {columns_sql}
            FROM measurements
            WHERE user_id = %s
            ORDER BY measured_at ASC
            LIMIT %s
            """,
            (uid, limit),
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
