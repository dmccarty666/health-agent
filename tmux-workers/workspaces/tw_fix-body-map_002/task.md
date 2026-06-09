PROJECT: health-agent frontend at /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/

ISSUE 1 - Body Map looks non-human in body-map.js:
- Replace SVG paths with proper human-proportioned body outline
- Add gradient/shading for body definition
- Segment labels should show different values per region

ISSUE 2 - Trends tab does not load for user (body-trends.js):
- Add visible loading spinner during data fetch
- Check API_BASE_URL in app.js points to localhost:8765
- Add detailed error messages with retry button
- Log errors to console so user can debug

ISSUE 3 - Segmental values all show same number:
- body-map.js should use real seg_*_muscle_kg fields when available
- Only fall back to distribution ratios when NULL

Verify with browser after changes.
