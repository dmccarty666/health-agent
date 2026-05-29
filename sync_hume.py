#!/usr/bin/env python3
"""
Hume Firebase → PostgreSQL sync for health-agent.
Pulls body measurements from Hume Health Firebase and inserts into
the health_agent PostgreSQL database using Blue2Scale schema.
"""

import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

import requests
import psycopg2
from psycopg2.extras import execute_values

# ─── Config ───────────────────────────────────────────────────────────────────

HUME_EMAIL = "david@mccarty-online.com"
HUME_PASSWORD = "Jackalope1!"
FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/myhealth-production/databases/(default)/documents"
DB_HOST = "localhost"
DB_NAME = "health_agent"
DB_USER = "dmccarty"
DB_PASS = ""  # Use peer auth or set in ~/.pgpass

USER_ID = "bDyPwmkNEFd7fQAs9kFCtV4x3eY2"

# ─── Hume → Blue2Scale field mapping ─────────────────────────────────────────

# Hume's JSON field names → Blue2Scale column names
FIELD_MAP = {
    "weight": "weight_kg",
    "bmi": "bmi",
    "fatRate": "body_fat_pct",
    "fatMass": "fat_mass_kg",
    "subcutaneousFat": "subcut_fat_kg",
    "subcutaneousFatRate": "subcut_fat_pct",
    "viscelarFat": "visceral_fat",
    "androidFat": "android_fat_kg",
    "gynoidFat": "gynoid_fat_kg",
    "androidGynoidRatio": "ag_ratio_pct",
    "leanMass": "lean_mass_kg",
    "leanMassRate": "lean_mass_pct",
    "skeletalMuscleMass": "skel_muscle_kg",
    "bodyCellMass": "body_cell_mass_kg",
    "moisture": "body_water_pct",
    "totalBodyWater": "total_water_kg",
    "extracellularWater": "ecw_kg",
    "intracellularWater": "icw_kg",
    "boneMass": "bone_mineral_kg",
    "mineralMass": "mineral_mass_kg",
    "skeletalMass": "skeletal_mass_kg",
    "organMass": "organ_mass_kg",
    "basalMetabolicRate": "bmr_kcal",
    "metabolicAge": "metabolic_age",
    # Segmental data
    "rightArmMuscleMass": "seg_right_arm_muscle_kg",
    "rightArmFatRate": "seg_right_arm_fat_pct",
    "rightArmFatMass": "seg_right_arm_fat_kg",
    "leftArmMuscleMass": "seg_left_arm_muscle_kg",
    "leftArmFatRate": "seg_left_arm_fat_pct",
    "leftArmFatMass": "seg_left_arm_fat_kg",
    "trunkMuscleMass": "seg_trunk_muscle_kg",
    "trunkFatRate": "seg_trunk_fat_pct",
    "trunkFatMass": "seg_trunk_fat_kg",
    "rightLegMuscleMass": "seg_right_leg_muscle_kg",
    "rightLegFatRate": "seg_right_leg_fat_pct",
    "rightLegFatMass": "seg_right_leg_fat_kg",
    "leftLegMuscleMass": "seg_left_leg_muscle_kg",
    "leftLegFatRate": "seg_left_leg_fat_pct",
    "leftLegFatMass": "seg_left_leg_fat_kg",
}


def get_auth():
    """Authenticate with Hume Health Firebase."""
    resp = requests.get(
        "https://myhealth-production.firebaseapp.com/__/firebase/init.json",
        timeout=10,
    )
    api_key = resp.json()["apiKey"]

    auth_resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={
            "email": HUME_EMAIL,
            "password": HUME_PASSWORD,
            "returnSecureToken": True,
        },
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HumeHealth/1.0 (iPhone; iOS 17.0; Scale/3.000)",
            "Origin": "https://myhealth-production.firebaseapp.com",
        },
        timeout=15,
    )

    data = auth_resp.json()
    if "error" in data:
        print(f"Auth error: {data['error']}")
        sys.exit(1)

    return data["idToken"], data["localId"]


def fetch_measurements(id_token):
    """Fetch body measurements from Hume Health Firebase."""
    resp = requests.get(
        f"{FIRESTORE_BASE}/users/{USER_ID}/bodyMeasurements?pageSize=500&orderBy=time desc",
        headers={"Authorization": f"Bearer {id_token}"},
        timeout=15,
    )

    result = resp.json()
    docs = result.get("documents", [])
    return docs


def transform_document(doc):
    """Convert a Hume Firestore document → Blue2Scale measurement dict."""
    fields = doc.get("fields", {})
    raw = {}

    for k, v in fields.items():
        if "doubleValue" in v:
            raw[k] = v["doubleValue"]
        elif "integerValue" in v:
            raw[k] = int(v["integerValue"])
        elif "stringValue" in v:
            raw[k] = v["stringValue"]

    # Skip deleted measurements
    if raw.get("deleted"):
        return None

    # Need at minimum weight and deviceTime
    if "weight" not in raw or "deviceTime" not in raw:
        return None

    device_time = raw.get("deviceTime", 0)
    measured_at = datetime.fromtimestamp(device_time / 1000).isoformat()

    mapped = {"measured_at": measured_at, "raw_ble_data": json.dumps(raw)}

    for hume_key, blue_key in FIELD_MAP.items():
        if hume_key in raw:
            mapped[blue_key] = raw[hume_key]

    return mapped


def insert_measurements(measurements):
    """Insert measurements into PostgreSQL, skipping duplicates."""
    conn = psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
    )
    conn.autocommit = True
    cur = conn.cursor()

    # Get existing measurement IDs
    cur.execute("SELECT id FROM measurements WHERE user_id = %s", (USER_ID,))
    existing_ids = {row[0] for row in cur.fetchall()}

    new_measurements = []
    for m in measurements:
        if m is None:
            continue
        mid = str(uuid.uuid4())
        if mid in existing_ids:
            continue  # Skip duplicates

        new_measurements.append((
            mid,
            USER_ID,
            m["measured_at"],
            m.get("device_name"),
            m.get("note"),
            m.get("raw_ble_data"),
            m.get("weight_kg"),
            m.get("bmi"),
            m.get("body_fat_pct"),
            m.get("fat_mass_kg"),
            m.get("subcut_fat_kg"),
            m.get("subcut_fat_pct"),
            m.get("visceral_fat"),
            m.get("android_fat_kg"),
            m.get("gynoid_fat_kg"),
            m.get("ag_ratio_pct"),
            m.get("lean_mass_kg"),
            m.get("lean_mass_pct"),
            m.get("skel_muscle_kg"),
            m.get("body_cell_mass_kg"),
            m.get("body_water_pct"),
            m.get("total_water_kg"),
            m.get("ecw_kg"),
            m.get("icw_kg"),
            m.get("bone_mineral_kg"),
            m.get("mineral_mass_kg"),
            m.get("skeletal_mass_kg"),
            m.get("organ_mass_kg"),
            m.get("bmr_kcal"),
            m.get("metabolic_age"),
            m.get("seg_right_arm_muscle_kg"),
            m.get("seg_right_arm_fat_pct"),
            m.get("seg_right_arm_fat_kg"),
            m.get("seg_left_arm_muscle_kg"),
            m.get("seg_left_arm_fat_pct"),
            m.get("seg_left_arm_fat_kg"),
            m.get("seg_trunk_muscle_kg"),
            m.get("seg_trunk_fat_pct"),
            m.get("seg_trunk_fat_kg"),
            m.get("seg_right_leg_muscle_kg"),
            m.get("seg_right_leg_fat_pct"),
            m.get("seg_right_leg_fat_kg"),
            m.get("seg_left_leg_muscle_kg"),
            m.get("seg_left_leg_fat_pct"),
            m.get("seg_left_leg_fat_kg"),
        ))

    if not new_measurements:
        print("No new measurements to insert.")
        cur.close()
        conn.close()
        return 0

    columns = [
        "id", "user_id", "measured_at", "device_name", "note", "raw_ble_data",
        "weight_kg", "bmi", "body_fat_pct", "fat_mass_kg", "subcut_fat_kg",
        "subcut_fat_pct", "visceral_fat", "android_fat_kg", "gynoid_fat_kg",
        "ag_ratio_pct", "lean_mass_kg", "lean_mass_pct", "skel_muscle_kg",
        "body_cell_mass_kg", "body_water_pct", "total_water_kg", "ecw_kg",
        "icw_kg", "bone_mineral_kg", "mineral_mass_kg", "skeletal_mass_kg",
        "organ_mass_kg", "bmr_kcal", "metabolic_age",
        "seg_right_arm_muscle_kg", "seg_right_arm_fat_pct", "seg_right_arm_fat_kg",
        "seg_left_arm_muscle_kg", "seg_left_arm_fat_pct", "seg_left_arm_fat_kg",
        "seg_trunk_muscle_kg", "seg_trunk_fat_pct", "seg_trunk_fat_kg",
        "seg_right_leg_muscle_kg", "seg_right_leg_fat_pct", "seg_right_leg_fat_kg",
        "seg_left_leg_muscle_kg", "seg_left_leg_fat_pct", "seg_left_leg_fat_kg",
    ]

    execute_values(
        cur,
        f"""INSERT INTO measurements ({', '.join(columns)})
             VALUES %s
             ON CONFLICT (id) DO NOTHING""",
        new_measurements,
    )

    inserted = cur.rowcount
    print(f"Inserted {inserted} new measurements.")
    cur.close()
    conn.close()
    return inserted


def main():
    print("Authenticating with Hume Health...")
    id_token, uid = get_auth()
    print(f"Authenticated as UID: {uid}")

    print("Fetching body measurements...")
    docs = fetch_measurements(id_token)
    print(f"Fetched {len(docs)} documents")

    transformed = [transform_document(doc) for doc in docs]
    valid = [m for m in transformed if m is not None]
    print(f"Valid measurements: {len(valid)}")

    if valid:
        print("Latest measurement:")
        latest = valid[0]
        print(f"  {latest['measured_at']}: weight={latest['weight_kg']}kg, "
              f"BMI={latest['bmi']}, body_fat={latest['body_fat_pct']}%")

    print("Inserting into PostgreSQL...")
    inserted = insert_measurements(transformed)
    print(f"Done. {inserted} new records inserted.")


if __name__ == "__main__":
    main()
