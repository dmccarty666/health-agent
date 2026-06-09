#!/bin/bash
cd /home/dmccarty/.hermes/PROJECTS/health-agent/frontend
errors=0
for f in js/body-overview.js js/body-trends.js js/body-map.js; do
  if node --check "$f" 2>/dev/null; then
    echo "OK: $f"
  else
    echo "FAIL: $f"
    errors=$((errors + 1))
  fi
done
exit $errors
