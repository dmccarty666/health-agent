-- Migration 0001: add source column to measurements
--
-- Why: distinguish rows from the Pi BLE bridge (humepi-bridge) vs rows
-- ingested from Apple Health (Hume's actual computed values, ground truth).
--
-- Backfill: all 147 existing rows are from the bridge. The DEFAULT 'bridge'
-- in ADD COLUMN handles them automatically; the explicit UPDATE is a
-- belt-and-suspenders no-op for any row that somehow ended up NULL.
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / WHERE source IS NULL.
--
-- Rollback: ALTER TABLE measurements DROP COLUMN source;

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'bridge';

UPDATE measurements
   SET source = 'bridge'
 WHERE source IS NULL OR source = '';

-- Allow 'bridge', 'apple_health', 'manual', or any future source.
-- VARCHAR(32) is loose on purpose; we don't want a CHECK constraint blocking
-- legitimate new sources. Validation happens at the application layer.

COMMENT ON COLUMN measurements.source IS
  'Provenance: bridge (Pi BLE listener) | apple_health (Hume via HealthKit) | manual (future)';
