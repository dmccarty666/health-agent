Fix the health-agent frontend at /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/

The user is in the US and wants ALL body measurements displayed in lbs, not kg.

ISSUES TO FIX:

1. UNIT CONVERSION (kg → lbs):
   - All weight-based values should display in lbs (1 kg = 2.20462 lbs)
   - Add unit conversion in the backend API OR frontend display layer
   - BMI, body_fat_pct, percentages should stay as-is
   - Only convert: weight_kg, fat_mass_kg, lean_mass_kg, skel_muscle_kg, bone_mineral_kg, subcut_fat_kg, etc (anything with _kg suffix except body_water_pct which is %)
   - Best approach: add a query param ?unit=lbs to the API, or add a helper function in the frontend that converts _kg fields to lbs for display
   - The simplest approach: add a fmtWeight() function in each JS module that converts kg→lbs
   - OR: convert at the API level in backend/app.py with a query parameter

2. FAT ANALYSIS CARD:
   - The Fat Analysis card currently shows 'Android Fat' and 'Gynoid Fat' fields
   - These don't exist in the Hume data (android_fat_kg and gynoid_fat_kg are NULL)
   - Remove or hide these if they're NULL
   - Check /home/dmccarty/.hermes/PROJECTS/health-agent/frontend/js/body-overview.js renderCategoryCards function

3. KEY METRICS CARD:
   - Metabolic age shows empty (NULL in DB)
   - The Hume app shows metabolic age as 41 years
   - Check how metabolic age is displayed in body-overview.js
   - If NULL, either hide it or estimate it

After fixing, verify:
- Weight shows as lbs in Overview stat cards
- Fat Analysis card doesn't show Android/Gynoid if NULL
- Key Metrics card handles missing metabolic age gracefully
