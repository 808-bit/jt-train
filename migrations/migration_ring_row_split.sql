-- Give the "low angle" ring row its own exercise_id so it can be logged and
-- progressed separately from the 45° ring row (previously both L1 and L2 of
-- mp_horiz_pull shared exercise_id 'ring_rows', so sets couldn't distinguish
-- which angle was actually trained).

INSERT INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes, requires_pair, movement_pattern_id, matrix_level, modality, logging_mode, bw_load_factor)
VALUES ('ring_rows_low_angle', 'Ring Row (Low Angle)', 'Pull', 'Rings', 'pull', 'Upper;Full Body A;Full Body B;Rings Only', 1, 1, 1, 'Feet closer to floor than standard ring row — steeper angle, harder pull', 0, 'mp_horiz_pull', 1, 'calisthenics', 'standard', 0.5);

UPDATE pattern_progressions
SET exercise_id = 'ring_rows_low_angle'
WHERE pattern_id = 'mp_horiz_pull' AND level = 2 AND exercise_id = 'ring_rows';

-- ring_rows now progresses in-order to its own low-angle variant, which then
-- progresses to deep_ring_rows
UPDATE progression_rules SET next_exercise_id = 'ring_rows_low_angle' WHERE exercise_id = 'ring_rows';

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('ring_rows_low_angle', '3x10', 2, 2, 'deep_ring_rows', NULL, 'rings', 'Steeper angle mastered — increase depth/lean for deep ring rows');
