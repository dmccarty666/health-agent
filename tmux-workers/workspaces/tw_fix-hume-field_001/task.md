You are fixing the health-agent sync_hume.py field mapping at /home/dmccarty/.hermes/PROJECTS/health-agent/sync_hume.py

PROBLEM: The Hume Firebase raw data uses different field names than what our FIELD_MAP expects. As a result, many fields (segmental data, metabolic rate, water compartments, etc.) are stored as NULL in PostgreSQL.

ACTUAL HUME FIELDS (from raw_ble_data JSON):
- fatFreeMass (75.7) → should map to lean_mass_kg
- muscleMass (70.6) → should map to skel_muscle_kg
- muscleRate (76.8) → could map to lean_mass_pct
- waterECWKg (20.7) → should map to ecw_kg
- waterICWKg (34.8) → should map to icw_kg
- mineralKg (5.1) → should map to mineral_mass_kg
- bodySkeletal (47.5) → could map to skeletal_mass_kg
- cellMassKg (50) → could map to body_cell_mass_kg
- proteinMass (15.1) → protein mass
- bodyFatSubCutKg (13.9) → different from subcutaneousFat

SEGMENTAL (index values, NOT kg):
- rightArmMuscleWeightIndex (4.0)
- leftArmMuscleWeightIndex (3.9)
- trunkMuscleWeightIndex (33.3)
- rightLegMuscleIndex (11.8)
- leftLegMuscleIndex (12.6)
- rightArmFatIndex (1.0), leftArmFatIndex (1.1), trunkFatIndex (8.3), rightLegFatIndex (2.2), leftLegFatIndex (2.1)

The Hume app converts segmental indices to lbs using: segment_kg = index * (total_muscle_kg / sum_of_indices)
For fat: segment_fat_kg = index * (total_fat_kg / sum_of_fat_indices)

TASK:
1. Update FIELD_MAP to match the actual Hume field names above
2. Add a compute_segmental() function that converts segmental indices to kg values using the formula above
3. The segmental fat% fields (bodyFatRate*Arm/Leg) are all 100.0 — broken. Instead compute: seg_fat_pct = (seg_fat_kg / (seg_muscle_kg + seg_fat_kg)) * 100
4. Run the sync script to verify new fields populate
5. Check that metabolic_age exists in any form (it doesn't in this raw data — note that)

After fixing, the database should have segmental data and more populated fields.
RUN THE SYNC after editing to verify.
