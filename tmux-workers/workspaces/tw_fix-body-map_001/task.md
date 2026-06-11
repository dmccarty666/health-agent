Fix the health-agent frontend Body Map visualization and Trends tab loading at /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/

ISSUE 1: BODY MAP SVG — looks non-human/crazy
- File: /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/js/body-map.js
- The SVG body silhouette uses hand-drawn paths that look unnatural
- David sent a screenshot of the Hume app showing their body diagram — it's a clean, human-proportioned silhouette with green color coding and value labels on each segment
- Fix: replace the SVG paths with proper human-proportioned body outline
- Add a subtle gradient/shading to make body parts more defined
- Ensure segment colors work with the distribution estimates
- The Hume app body diagram shows: Right Arm, Left Arm, Trunk, Right Leg, Left Leg with lbs values and health ratings (Standard/Low)

ISSUE 2: TRENDS TAB DOESN'T LOAD
- File: /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/js/body-trends.js
- David reports Trends tab never loads for him
- It works in Browserbase browser but not in his actual browser
- Possible causes:
  a. CORS issue — API on port 8765, frontend on 8080 — different ports
  b. Chart.js CDN not loading
  c. API endpoint returning error silently
  d. Timing/race condition
- Fix:
  a. Check app.js for API_BASE_URL — make sure it points to localhost:8765
  b. Add more visible error messages with specific error details
  c. Add a timeout and fallback for Chart.js loading
  d. Add console logging that explains what's happening
  e. Make the empty state more informative (show the actual error)

ISSUE 3: Segmental values all show same number
- Currently using distribution ratios which give very similar values
- After Worker 1 fixes the sync, real segmental data should be available
- Make sure the body-map.js uses real segmental data when available (check seg_right_arm_muscle_kg etc.)
- Fall back to distribution ratios only when real data is NULL

AFTER FIXING check all three issues are resolved.
