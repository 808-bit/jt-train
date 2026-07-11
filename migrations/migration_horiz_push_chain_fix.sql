-- Restructure mp_horiz_push into two parallel tracks under the same pattern
-- (still one movement quality — horizontal push — just two equipment paths,
-- unlike the hinge/power split which was a genuine training-quality split):
--   Bodyweight/parallette track: push_ups -> parallette_pushups -> neutral_grip_parallette_pushups (ceiling)
--   Rings track: incline_ring_pushup -> ring_pushups -> rto_ring_pushup -> ring_archer_pushups (ceiling)
-- Also drops kb_floor_press from progression_rules entirely (not part of
-- either bodyweight/rings track).

DELETE FROM progression_rules WHERE exercise_id = 'kb_floor_press';

-- Renumber existing rows: bodyweight/parallette track = 1-3
UPDATE pattern_progressions SET level = 1 WHERE pattern_id = 'mp_horiz_push' AND exercise_id = 'push_ups';
UPDATE pattern_progressions SET level = 2 WHERE pattern_id = 'mp_horiz_push' AND exercise_id = 'parallette_pushups';

-- Add neutral_grip_parallette_pushups as the ceiling of the bodyweight/parallette track
INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_horiz_push', 3, 'neutral_grip_parallette_pushups', 'Neutral Grip Parallette Push-up', 'dynamic', '3x15', 2, NULL, 'parallettes_low');

-- neutral_grip_parallette_pushups is now a ceiling, not a bridge into rings
UPDATE progression_rules
SET next_exercise_id = NULL, next_exercise_alt = NULL, next_requires = NULL,
    notes = 'Neutral grip reduces shoulder stress — ceiling of the bodyweight/parallette track'
WHERE exercise_id = 'neutral_grip_parallette_pushups';

-- Rings track: renumber existing rows to 5-6, add incline entry point (4) and archer ceiling (7)
UPDATE pattern_progressions SET level = 5 WHERE pattern_id = 'mp_horiz_push' AND exercise_id = 'ring_pushups';
UPDATE pattern_progressions SET level = 6 WHERE pattern_id = 'mp_horiz_push' AND exercise_id = 'rto_ring_pushup';

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_horiz_push', 4, 'incline_ring_pushup', 'Incline Ring Push-up', 'dynamic', '3x15', 2, NULL, 'rings');

INSERT INTO pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, rep_target, rir_target, duration_target, equipment)
VALUES ('mp_horiz_push', 7, 'ring_archer_pushups', 'Ring Archer Push-up', 'dynamic', '3x8', 2, NULL, 'rings');

-- Rings track rules: incline -> ring_pushups (existing) -> rto (existing) -> archer (new ceiling)
INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('incline_ring_pushup', '3x15', 2, 2, 'ring_pushups', NULL, 'rings', 'Elevated entry point to ring instability — reduce incline as strength builds');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('rto_ring_pushup', '3x8', 2, 2, 'ring_archer_pushups', NULL, 'rings', 'Turned-out grip mastered — unilateral loading shift toward one-arm push-up strength');

INSERT INTO progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, next_exercise_id, next_exercise_alt, next_requires, notes)
VALUES ('ring_archer_pushups', '3x8', 2, 2, NULL, NULL, 'rings', 'Ceiling of the rings track — not shoulder_safe, monitor closely given impingement history');
