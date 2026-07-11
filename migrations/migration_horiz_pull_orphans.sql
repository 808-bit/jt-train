-- Insert feet_elevated_ring_row into the rings chain (a bodyweight-load
-- lever, distinct from the angle/grip levers already in the chain), and add
-- a separate parallel KB row track (kb_row -> kb_hip_hinge_row ->
-- kb_renegade_row) under mp_horiz_pull.

UPDATE pattern_progressions SET level = 4 WHERE pattern_id = 'mp_horiz_pull' AND exercise_id = 'deep_ring_rows';
UPDATE pattern_progressions SET level = 5 WHERE pattern_id = 'mp_horiz_pull' AND exercise_id = 'false_grip_ring_rows';
UPDATE pattern_progressions SET level = 6 WHERE pattern_id = 'mp_horiz_pull' AND exercise_id = 'archer_ring_row';

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_horiz_pull', 3, 'feet_elevated_ring_row', 'Feet-Elevated Ring Row', 'dynamic', '3x10', 2, NULL, 'rings');

UPDATE progression_rules SET next_exercise_id = 'feet_elevated_ring_row' WHERE exercise_id = 'ring_rows_low_angle';
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('feet_elevated_ring_row', '3x10', 2, 2, 'deep_ring_rows', NULL, 'rings', 'Higher bodyweight percentage tolerated — increase depth/lean for deep ring rows');

-- Parallel KB row track, levels 7-9
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_horiz_pull', 7, 'kb_row', 'KB Row', 'dynamic', '3x12', 2, NULL, NULL),
('mp_horiz_pull', 8, 'kb_hip_hinge_row', 'KB Hip Hinge Row', 'dynamic', '3x10', 2, NULL, NULL),
('mp_horiz_pull', 9, 'kb_renegade_row', 'KB Renegade Row', 'dynamic', '3x8', 2, NULL, NULL);

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('kb_row', '3x12', 2, 2, 'kb_hip_hinge_row', NULL, NULL, 'Standing/supported row mastered — add the hip hinge for greater ROM and hamstring/core demand'),
('kb_hip_hinge_row', '3x10', 2, 2, 'kb_renegade_row', NULL, NULL, 'Hinge row mastered — move to plank position for anti-rotation core demand'),
('kb_renegade_row', '3x8', 2, 2, NULL, NULL, NULL, 'Ceiling of the KB row track — anti-rotation core plus unilateral pulling');
