PROJECT: health-agent at /home/dmccarty/.hermes/PROJECTS/health-agent/
FILE: sync_hume.py

The Hume Firebase raw data uses DIFFERENT field names than our FIELD_MAP. Fix the mapping.

ACTUAL HUME KEYS (from raw_ble_data):
- fatFreeMass (75.7) → lean_mass_kg
- muscleMass (70.6) → skel_muscle_kg
- waterECWKg (20.7) → ecw_kg
- waterICWKg (34.8) → icw_kg
- mineralKg (5.1) → mineral_mass_kg
- bodySkeletal (47.5) → skeletal_mass_kg
- cellMassKg (50) → body_cell_mass_kg
- muscleRate (76.8) → lean_mass_pct

Segmental are INDICES, not kg: rightArmMuscleWeightIndex, leftArmMuscleWeightIndex, etc.
Convert: segment_kg = index * (total_muscle_kg / sum_of_all_indices)

Fix FIELD_MAP, add compute_segmental() function, run sync. Verify with psql.
