PROJECT: health-agent frontend at /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/

The user is in the US - ALL weight values must display in LBS, not kg.

TASKS:
1. Add kg→lbs conversion in body-overview.js, body-trends.js, body-map.js
   - Conversion: lbs = kg * 2.20462
   - Only convert _kg fields, NOT percentages or BMI
   - Add fmtWeight() helper to each module

2. Fix Fat Analysis card in body-overview.js:
   - Android fat and Gynoid fat fields are NULL - hide them
   - Only show fields that have actual values

3. Fix Key Metrics card in body-overview.js:
   - Metabolic age is NULL in Hume data - hide it gracefully
   - Show other available metrics (BMR, Visceral Fat, Bone Mineral)

Verify all changes after editing.
