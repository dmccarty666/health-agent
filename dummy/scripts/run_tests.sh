#!/usr/bin/env bash
# run_tests.sh — CI-parity test runner wrapper for Dummy Project.
# Always use this instead of running pytest directly.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure tests/ is discovered
pytest tests/ "$@"