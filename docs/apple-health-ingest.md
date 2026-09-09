# Apple Health Ingest — Design

**Status:** Phase 0 (historical export) ready; Phase 1 (live sync) optional.
**Branch:** `feat/apple-health-ingest`
**Last updated:** 2026-09-09

## Why we need this

The humepi-bridge reverse-engineers Hume's BIA formulas from BLE packets. We
achieved ~1% match on primary metrics via impedance scaling (0.818x, later
0.80x) but secondary metrics (BMR slope, mineral/skeletal ratios, metabolic
age, visceral fat) keep drifting by 1-3pp. Hume writes its *actual* computed
values to Apple Health as `HKQuantityTypeIdentifier*` records, and those
values are the ground truth we never had.

This ingest path:

1. **Phase 0 (free):** one-shot historical export from Apple Health -> XML ->
   parse -> upsert into `measurements` with `source='apple_health'`.
2. **Phase 1 ($24.99 once):** continuous background sync via
   [HealthSave](https://healthsave.app) iOS app -> IONOS relay -> AIDEV.

After both phases, `measurements` holds rows from both `source='bridge'` (Pi
BLE listener) and `source='apple_health'` (Hume-computed). Cross-checking
them in the dashboard tells us whether the bridge drift is formula error
(calibrate once, done) or measurement noise (calibrate to the average).

## Architecture

```
+--------------------------------------------------------------------+
| iPhone (Apple Health)                                             |
|   +-- Hume Health (writes computed values)                         |
|       +-- HKQuantityTypeIdentifier* records                        |
|                                                                   |
|   Phase 0: user taps "Export Health Data" -> export.zip             |
|     v (manual AirDrop / iCloud / curl)                            |
|   /disk2/aem-dev/imports/apple_health_export.zip                   |
|     v                                                              |
|   scripts/parse_apple_health.py  (one-shot, runs on AIDEV)         |
|     v                                                              |
|   POST /api/ingest/apple_health  (HMAC, batch upsert)              |
|                                                                   |
|   Phase 1: HealthSave iOS app (background sync, ~1-5min cadence)  |
|     v (HTTPS POST, X-API-Key header)                              |
|   IONOS relay  https://ionos-vm/health-ingest                     |
|     v (verify API key, re-sign with AIDEV HMAC)                   |
|   POST http://aidev.local:8765/api/ingest/apple_health            |
|     v                                                              |
|   PostgreSQL measurements table (id, user_id, measured_at, ...)   |
|     + new column: source VARCHAR(32) DEFAULT 'bridge'             |
+--------------------------------------------------------------------+
```

## Schema changes

Migration `migrations/0001_add_source_column.sql`:

```sql
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'bridge';

-- Backfill: all existing rows are from the Pi bridge
UPDATE measurements SET source = 'bridge' WHERE source IS NULL OR source = '';

-- 'apple_health' = Hume's values via Apple Health export / HealthSave
-- 'bridge'       = Pi BLE listener (humepi-bridge)
-- 'manual'       = human-typed entry (future)

COMMENT ON COLUMN measurements.source IS
  'Provenance: bridge (Pi BLE), apple_health (Hume via HealthKit), manual (future)';
```

The new column is `NOT NULL` with a default so the 147 existing rows stay
valid. No data loss. Idempotent migration (`IF NOT EXISTS`).

## Apple Health XML -> `measurements` mapping

The export XML uses HKQuantityTypeIdentifier constants as the `type`
attribute. We map the ones we care about:

| HKQuantityTypeIdentifier                | measurements column         |
|-----------------------------------------|------------------------------|
| `HKQuantityTypeIdentifierBodyMass`      | `weight_kg`                  |
| `HKQuantityTypeIdentifierBodyMassIndex` | `bmi`                        |
| `HKQuantityTypeIdentifierBodyFatPercentage` | `body_fat_pct`           |
| `HKQuantityTypeIdentifierLeanBodyMass`  | `lean_mass_kg`               |
| `HKQuantityTypeIdentifierBasalEnergyBurned` | `bmr_kcal`              |

Apple Health does NOT store the extended Hume metrics (skeletal muscle,
visceral fat index, metabolic age, segmental, etc.) - those are proprietary
to the Hume app and never written to HealthKit. So the Apple Health ingest
fills 5-6 columns; the bridge fills all 39.

`source='apple_health'` rows will be sparser than `source='bridge'` rows.
That's expected and useful: it's the fields where Apple's HealthKit is the
ground truth we can compare against.

## Phase 0 - one-shot historical ingest

Run by user once:

```bash
# On iPhone: Health app -> profile (top right) -> "Export Health Data"
#            -> confirm -> save to Files / iCloud Drive
# AirDrop or scp the export.zip to AIDEV:

scp apple_health_export.zip aidev:/disk2/dmccarty/PROJECTS/health-agent/imports/

# On AIDEV, run the parser:
cd /disk2/dmccarty/PROJECTS/health-agent
.venv/bin/python scripts/parse_apple_health.py \
    imports/apple_health_export.zip \
    --user-id "$(.venv/bin/python -c 'from backend.db import get_user_id; print(get_user_id())')"
```

The parser:

1. Unzips the export to a temp dir.
2. Streams `apple_health_export/export.xml` with `xml.etree.ElementTree.iterparse`
   (handles 500MB-1GB files without OOM).
3. Filters for `sourceName="Hume Health"` records only (ignores Apple Watch,
   Health auto-tracking, other apps).
4. Groups by `measured_at` (Apple Health stores each metric separately; one
   weigh-in produces ~5 records within the same second).
5. Builds a single `IngestMeasurementIn`-shaped payload per weigh-in.
6. POSTs each payload to `/api/ingest/apple_health` with HMAC signature.
7. Reports summary: N weigh-ins ingested, M skipped (no Hume source).

Dry-run flag (`--dry-run`) parses and prints without POSTing, so we can
sanity-check before committing.

## Phase 1 - live sync (optional, $24.99 one-time)

### Why an IONOS relay

iOS background sync refuses to talk to private RFC1918 addresses that lack
proper DNS. iPhones behind carrier NAT or Tailscale-only setups frequently
fail. The IONOS VM has a public hostname + Let's Encrypt TLS, which iOS
treats as "real internet" and syncs reliably.

The relay is a 30-line FastAPI app that:
- accepts POST on `/health-ingest` with HealthSave's batch JSON
- verifies `X-API-Key` header against a Doppler-fetched secret
- re-signs the payload with AIDEV's HMAC and POSTs to AIDEV `:8765`
- returns 200 OK fast (< 200ms target) so iOS doesn't drop the sync

### Why HealthSave over Health Auto Export

Both are $24.99 one-time, both have REST API automations. We chose HealthSave because:

- Wire format `POST /api/apple/batch` is documented and stable in their
  open-source repo (github.com/umutkeltek/healthsave-observatory)
- Their iOS app is built explicitly for self-hosters (matches our setup)
- Their batch JSON is simpler than HAE's configurable field naming
- The protocol/SDK layer is Apache-2.0; we're not locked in if they disappear

If HealthSave is unavailable, Health Auto Export works equally well - the
relay's translator layer would just need a different JSON parser.

### HealthSave wire format (frozen v1)

```http
POST /api/apple/batch HTTP/1.1
Content-Type: application/json
X-API-Key: <shared-secret>

{
  "api_key": "<shared-secret>",   // duplicated in body for legacy clients
  "batch": [
    {
      "metric": "weight",
      "unit": "kg",
      "value": 91.36,
      "timestamp": "2026-09-08T18:35:00Z",
      "source": "Hume Health",
      "device": "..."
    },
    ...
  ]
}
```

Our relay maps:
- `metric=weight,unit=kg` -> `weight_kg`
- `metric=weight,unit=lb` -> `weight_kg / 2.20462`
- `metric=body_fat_percentage,unit=%` -> `body_fat_pct`
- `metric=lean_body_mass,unit=kg` -> `lean_mass_kg`
- `metric=lean_body_mass,unit=lb` -> `lean_mass_kg / 2.20462`
- `metric=bmi,unit=count` -> `bmi`
- `metric=basal_energy_burned,unit=kcal` -> `bmr_kcal`

Other metrics are stored in `raw_ble_data` JSONB column for future
re-processing if we discover Hume writes more to HealthKit than expected.

## Files added / modified

### Added
- `docs/apple-health-ingest.md` - this file
- `scripts/parse_apple_health.py` - Phase 0 XML parser
- `scripts/apple_health_to_measurements.py` - HK type -> column mapper
- `backend/apple_health_schema.py` - Pydantic models for HealthSave batch
- `migrations/0001_add_source_column.sql` - schema migration

### Modified
- `backend/models.py` - add `source` to `MeasurementOut`, add `AppleHealthBatchIn`
- `backend/app.py` - add `POST /api/ingest/apple_health` route
- `schema.sql` - add `source` column for fresh installs
- `README.md` - note the new source column

### NOT in this repo
- `health-ingest-relay/` - separate project, lives at
  `/disk2/dmccarty/PROJECTS/health-ingest-relay/`, documented separately
  (IONOS-only deployment).

## Cost summary

| Item | Cost | Recurring? |
|---|---|---|
| Apple Health XML export (Phase 0) | $0 | Never |
| AIDEV ingest endpoint | $0 | Never |
| IONOS relay service | $0 (already running) | Never |
| HealthSave iOS app (Phase 1) | $24.99 one-time | Never |
| **Total one-time** | **$24.99** | |
| **Total recurring** | **$0** | |

No Apple Developer Program fee. No jailbreak. No monthly subscription.

## Rollback

Schema migration is reversible:

```sql
ALTER TABLE measurements DROP COLUMN source;
```

The new ingest route can be removed by reverting `backend/app.py` and
`backend/models.py`. No data loss either way - the existing 147 rows are
untouched because of the `DEFAULT 'bridge'` backfill.
