-- kb_halos is mobility/rehab work, not a core progression step.
-- ring_support_hold -> ring_l_sit is a rings-equivalent parallel track to
-- the existing parallette L-sit track (support_hold -> parallette_l_sit ->
-- l_sit -> ring_lsit_pullup).
-- ring_knee_raises -> ring_body_saw is its own mini ab progression.

UPDATE exercises SET movement_pattern_id = 'mp_rehab' WHERE id = 'kb_halos';

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment) VALUES
('mp_core', 5, 'ring_support_hold', 'Ring Support Hold', 'isometric', NULL, 2, '3x20s', 'rings'),
('mp_core', 6, 'ring_l_sit', 'Ring L-Sit', 'isometric', NULL, 2, '3x10s', 'rings'),
('mp_core', 7, 'ring_knee_raises', 'Ring Knee Raises', 'dynamic', '3x12', 2, NULL, 'rings'),
('mp_core', 8, 'ring_body_saw', 'Ring Body Saw', 'dynamic', '3x10', 2, NULL, 'rings');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes) VALUES
('ring_support_hold', '3x20s', 2, 2, 'ring_l_sit', NULL, 'rings', 'Shoulder stability with protraction/depression established — extend legs for the ring L-sit'),
('ring_l_sit', '3x10s', 2, 2, NULL, NULL, 'rings', 'Ceiling of the rings L-sit track'),
('ring_knee_raises', '3x12', 2, 2, 'ring_body_saw', NULL, 'rings', 'Hanging knee raise control established — progress to the pike-and-extend body saw'),
('ring_body_saw', '3x10', 2, 2, NULL, NULL, 'rings', 'Ceiling of the ring ab track');
