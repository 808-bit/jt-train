-- double_kb_clean and kb_snatch are ballistic/explosive hip-driven movements
-- (same spirit as kb_swing/double_kb_swing), not linear hinge-strength work
-- — move them into mp_power_conditioning.
-- kb_single_leg_deadlift (redundant alt for single_leg_kb_rdl's slot) and
-- windmill_kb (specialty rotational movement) are left standalone/untouched.
-- banded_tricep_pushdowns is isolation accessory, left standalone.

UPDATE exercises SET movement_pattern_id = 'mp_power_conditioning' WHERE id IN ('double_kb_clean', 'kb_snatch');

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_power_conditioning', 3, 'double_kb_clean', 'Double KB Clean', 'dynamic', '3x8', 2, NULL, NULL),
('mp_power_conditioning', 4, 'kb_snatch', 'KB Snatch', 'dynamic', '3x8', 2, NULL, NULL);

UPDATE progression_rules SET next_exercise_id = 'double_kb_clean' WHERE exercise_id = 'double_kb_swing';

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('double_kb_clean', '3x8', 2, 2, 'kb_snatch', NULL, NULL, 'Bilateral ballistic catch/rack skill established — add the full floor-to-overhead snatch'),
('kb_snatch', '3x8', 2, 2, NULL, NULL, NULL, 'Ceiling of the power/conditioning track — highest-skill ballistic movement');
