#!/usr/bin/env python3
"""Apple Health export parser -> /api/ingest/apple_health.

Usage:
    .venv/bin/python scripts/parse_apple_health.py \\
        imports/apple_health_export.zip \\
        --user-id <uuid> \\
        [--source-filter "Hume Health"] \\
        [--dry-run] \\
        [--api-base http://aidev.local:8765]

The parser streams the export.xml with iterparse to handle 500MB-1GB files
without OOM. It filters for `sourceName="Hume Health"` (or whatever you pass
to --source-filter), groups Records by measured_at timestamp, and posts each
group as a single ingest payload.

Apple Health stores one weigh-in's metrics as N Records with the same
timestamp within a few seconds (one for weight, one for body fat %, one for
BMI, etc.). We collapse them into one measurements row per weigh-in.

Why we don't POST to AIDEV directly:
    AIDEV is LAN-only (UFW is the perimeter). The parser runs on AIDEV so
    it can talk to localhost:8765 directly. If you run this script from
    another host (e.g. your laptop), pass --api-base http://aidev.local:8765
    and make sure the host is on the tailnet.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import http.client
import json
import os
import sys
import tempfile
import time
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

# Make the backend package importable when running from the repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.apple_health_to_measurements import (  # noqa: E402
    map_hk_record_to_column,
    parse_hk_date,
)


# HMAC config - matches backend/app.py INGEST_SECRET default
INGEST_SECRET = os.environ.get("SCALE_INGEST_SECRET", "dev-secret-change-me")


def sign_payload(raw_body: bytes, secret: str = INGEST_SECRET) -> tuple:
    """Return (timestamp, signature) headers for the ingest endpoint."""
    timestamp = str(int(time.time()))
    sig = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return timestamp, sig


def post_ingest(
    api_base: str,
    path: str,
    payload: dict,
    dry_run: bool = False,
) -> tuple:
    """POST a JSON payload to the ingest endpoint with HMAC headers."""
    raw_body = json.dumps(payload).encode("utf-8")
    timestamp, sig = sign_payload(raw_body)
    if dry_run:
        print(f"[DRY RUN] would POST {path} with {len(raw_body)} bytes")
        return True, "dry-run"

    parsed = urlparse(api_base)
    conn = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=30)
    try:
        conn.request(
            "POST",
            path,
            body=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Scale-Timestamp": timestamp,
                "X-Scale-Signature": sig,
            },
        )
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        ok = 200 <= resp.status < 300
        return ok, f"{resp.status} {body[:200]}"
    finally:
        conn.close()


def parse_export(
    xml_path: Path,
    source_filter: str = "Hume Health",
) -> dict:
    """Stream export.xml, group Hume-sourced records by measured_at.

    Returns: { measured_at: {column: value, ...}, ... }
        plus per-group raw_ble_data list of unmapped records.
    """
    groups: dict = defaultdict(lambda: {
        "metrics": {},
        "raw_records": [],
        "source_version": None,
    })

    records_seen = 0
    records_kept = 0
    records_unmapped = 0

    # iterparse with 'end' event for Record elements - lets us drop them
    # from memory immediately. Critical for 1GB files.
    context = ET.iterparse(xml_path, events=("end",))
    for event, elem in context:
        if elem.tag != "Record":
            continue

        records_seen += 1
        if records_seen % 50000 == 0:
            print(f"  ...scanned {records_seen} records, kept {records_kept} so far",
                  file=sys.stderr)

        source_name = elem.get("sourceName", "")
        if source_filter and source_name != source_filter:
            elem.clear()
            continue

        hk_type = elem.get("type", "")
        try:
            value = float(elem.get("value", ""))
        except ValueError:
            elem.clear()
            continue

        unit = elem.get("unit", "")
        try:
            measured_at = parse_hk_date(elem.get("startDate", ""))
        except (ValueError, TypeError):
            elem.clear()
            continue

        mapped = map_hk_record_to_column(hk_type, value, unit)
        if mapped is None:
            # Store unmapped Hume records in raw_ble_data for later analysis.
            groups[measured_at]["raw_records"].append({
                "hk_type": hk_type,
                "value": value,
                "unit": unit,
                "source_version": elem.get("sourceVersion"),
            })
            records_unmapped += 1
        else:
            col, converted = mapped
            # Don't overwrite if we already have a value for this column at
            # this timestamp (Apple Health sometimes has duplicates).
            if col not in groups[measured_at]["metrics"]:
                groups[measured_at]["metrics"][col] = converted
                groups[measured_at]["source_version"] = elem.get("sourceVersion")
                records_kept += 1

        elem.clear()  # free memory - critical for huge files

    print(
        f"  scanned {records_seen} records total, "
        f"{records_kept} mapped to known columns, "
        f"{records_unmapped} stored as raw_ble_data",
        file=sys.stderr,
    )
    return dict(groups)


def build_ingest_payload(
    measured_at: datetime,
    group: dict,
    user_id: str,
) -> dict:
    """Build the IngestMeasurementIn-shaped payload from a parsed group."""
    metrics = group["metrics"]
    raw_records = group["raw_records"]
    return {
        "measured_at": measured_at.isoformat(),
        "device_name": "Apple Health (Hume Health)",
        "note": f"source_version={group.get('source_version') or 'unknown'}",
        "source": "apple_health",
        # The 39 known columns - only fill what we have
        **{k: v for k, v in metrics.items()},
        # raw_ble_data is a JSONB column on measurements; it stores the
        # full unmapped set for future re-processing if we discover more
        # Hume metrics exist.
        "raw_ble_data": {
            "import_source": "apple_health_export",
            "imported_at": datetime.utcnow().isoformat() + "Z",
            "raw_records": raw_records,
        } if raw_records else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Parse Apple Health export.zip and ingest Hume-sourced records."
    )
    parser.add_argument(
        "export_zip",
        type=Path,
        help="Path to apple_health_export.zip from iPhone Health app",
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="UUID of the user (use backend.db.get_user_id())",
    )
    parser.add_argument(
        "--source-filter",
        default="Hume Health",
        help='Only ingest records with this sourceName (default: "Hume Health")',
    )
    parser.add_argument(
        "--api-base",
        default="http://aidev.local:8765",
        help="AIDEV backend URL (default: http://aidev.local:8765)",
    )
    parser.add_argument(
        "--ingest-path",
        default="/api/ingest/apple_health",
        help="Ingest endpoint path (default: /api/ingest/apple_health)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and print without POSTing",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Stop after N payloads (0 = all). Useful for testing.",
    )
    args = parser.parse_args()

    if not args.export_zip.exists():
        print(f"ERROR: {args.export_zip} not found", file=sys.stderr)
        return 1

    print(f"Opening {args.export_zip} ...")
    with zipfile.ZipFile(args.export_zip) as zf:
        xml_member = next(
            (n for n in zf.namelist() if n.endswith("export.xml")),
            None,
        )
        if xml_member is None:
            print("ERROR: no export.xml found in zip", file=sys.stderr)
            return 1
        print(f"Found {xml_member}")
        # Extract to a tempfile so iterparse can stream it without holding
        # the whole zip in memory.
        with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with zf.open(xml_member) as src:
                # Stream-copy in 8MB chunks so even a 1GB xml doesn't OOM.
                while True:
                    chunk = src.read(8 * 1024 * 1024)
                    if not chunk:
                        break
                    tmp.write(chunk)
            print(f"Extracted to {tmp_path}")

    try:
        print(f"Parsing (source_filter={args.source_filter!r}) ...")
        groups = parse_export(tmp_path, source_filter=args.source_filter)
    finally:
        tmp_path.unlink(missing_ok=True)

    n_total = len(groups)
    print(f"Found {n_total} distinct weigh-in timestamps")

    if args.dry_run:
        sorted_keys = sorted(groups.keys())
        for k in sorted_keys[:3] + sorted_keys[-1:]:
            payload = build_ingest_payload(k, groups[k], args.user_id)
            print(json.dumps(payload, indent=2, default=str))
        return 0

    inserted = 0
    updated = 0
    failed = 0
    for i, measured_at in enumerate(sorted(groups.keys())):
        if args.limit and i >= args.limit:
            break
        payload = build_ingest_payload(measured_at, groups[measured_at], args.user_id)
        ok, response = post_ingest(args.api_base, args.ingest_path, payload, dry_run=False)
        if not ok:
            failed += 1
            print(f"  FAIL {measured_at.isoformat()}: {response}", file=sys.stderr)
        else:
            if '"action": "inserted"' in response:
                inserted += 1
            elif '"action": "updated"' in response:
                updated += 1
            if (i + 1) % 25 == 0 or i == n_total - 1:
                print(
                    f"  [{i + 1}/{n_total}] "
                    f"inserted={inserted} updated={updated} failed={failed}"
                )

    print(
        f"\nDone. {n_total} weigh-ins: {inserted} inserted, {updated} updated, {failed} failed"
    )
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
