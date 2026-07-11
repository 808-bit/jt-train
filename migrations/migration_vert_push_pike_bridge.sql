-- Insert pike_pushups -> pike_pushup_elevated as the bodyweight bridge
-- between dips (levels 1-3) and the KB overhead branch (previously 4-8,
-- shifted to 6-10) in mp_vert_push.

UPDATE pattern_progressions SET level = 6 WHERE pattern_id = 'mp_vert_push' AND exercise_id = 'single_arm_kb_press';
UPDATE pattern_progressions SET level = 7 WHERE pattern_id = 'mp_vert_push' AND exercise_id = 'kb_push_press';
UPDATE pattern_progressions SET level = 8 WHERE pattern_id = 'mp_vert_push' AND exercise_id = 'kb_clean_and_press';
UPDATE pattern_progressions SET level = 9 WHERE pattern_id = 'mp_vert_push' AND exercise_id = 'kb_thruster';
UPDATE pattern_progressions SET level = 10 WHERE pattern_id = 'mp_vert_push' AND exercise_id = 'kb_armor_complex';

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_vert_push', 4, 'pike_pushups', 'Pike Push-up', 'dynamic', '3x10', 2, NULL, NULL),
('mp_vert_push', 5, 'pike_pushup_elevated', 'Elevated Pike Push-up', 'dynamic', '3x8', 2, NULL, NULL);

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('ring_dips', '3x10', 2, 2, 'pike_pushups', NULL, NULL, 'Dip track ceiling — bodyweight overhead-pressing pattern begins here'),
('pike_pushups', '3x10', 2, 2, 'pike_pushup_elevated', NULL, NULL, 'Feet elevated further increases vertical load over the shoulders'),
('pike_pushup_elevated', '3x8', 2, 2, 'single_arm_kb_press', NULL, NULL, 'Bodyweight overhead pattern established — add external load');
