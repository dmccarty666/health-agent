#!/usr/bin/env bash
# heartbeat.sh — project-specific shim that delegates to the framework version.
#
# This script just sets PROJECT_DIR and invokes the framework heartbeat.
# Do not put project-specific logic here — modify project.yaml instead.

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec env PROJECT_DIR="$PROJECT_DIR" \
    ~/.hermes/PROJECTS/.framework/scripts/heartbeat.sh "$@"
