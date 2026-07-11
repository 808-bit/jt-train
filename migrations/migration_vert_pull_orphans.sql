-- Resolve remaining mp_vert_pull orphans: scapular_pullup is accessory/rehab
-- work (not a progression step), ring_muscle_up is the true capstone of the
-- rings track (a combination skill, not strictly gated on typewriter pull-up
-- but placed after it since it's the hardest thing in this track).

UPDATE exercises SET movement_pattern_id = 'mp_rehab', notes = 'Dead hang, engage shoulder blades only, no elbow bend — pull-up shoulder health foundation' WHERE id = 'scapular_pullup';

UPDATE exercises SET notes = 'Transition from pull to dip on rings — combines false-grip pulling strength with a dip lockout' WHERE id = 'ring_muscle_up';

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_vert_pull', 13, 'ring_muscle_up', 'Ring Muscle Up', 'dynamic', '3x3', 2, NULL, 'rings');

UPDATE progression_rules SET next_exercise_id = 'ring_muscle_up' WHERE exercise_id = 'ring_typewriter_pullup';

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('ring_muscle_up', '3x3', 2, 2, NULL, NULL, 'rings', 'Ceiling of the rings track — combination skill. Real prerequisites are false_grip_ring_rows (mp_horiz_pull) for the pull and ring_dips (mp_vert_push) for the dip lockout, not strictly the typewriter pull-up.');
