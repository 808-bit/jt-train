-- Add gorilla_row (hinged, braced alternating row) between kb_hip_hinge_row
-- and kb_renegade_row in the KB row track under mp_horiz_pull. Distinct
-- from renegade row: hip-hinged athletic stance with a braced support hand,
-- vs renegade row's full plank anti-rotation demand.

INSERT INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes, requires_pair, movement_pattern_id, matrix_level, modality, bw_load_factor, logging_mode)
VALUES ('gorilla_row', 'Gorilla Row', 'Pull', 'KB', 'pull', 'Upper;Full Body A;Full Body B', 0, 1, 1, 'Two bells on floor, hip-hinged athletic stance, alternate rowing while bracing the other hand on the resting bell', 0, 'mp_horiz_pull', 2, 'calisthenics', 1, 'standard');

UPDATE pattern_progressions SET level = 10 WHERE pattern_id = 'mp_horiz_pull' AND exercise_id = 'kb_renegade_row';
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_horiz_pull', 9, 'gorilla_row', 'Gorilla Row', 'dynamic', '3x10', 2, NULL, NULL);

UPDATE progression_rules SET next_exercise_id = 'gorilla_row' WHERE exercise_id = 'kb_hip_hinge_row';
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('gorilla_row', '3x10', 2, 2, 'kb_renegade_row', NULL, NULL, 'Hinged alternating row with braced support mastered — remove the hinge stance for full plank anti-rotation demand');
