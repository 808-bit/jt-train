-- Remove neutral_grip_parallette_pushups as a chain step in mp_horiz_push.
-- parallette_pushups becomes the ceiling of the bodyweight/parallette track
-- again (it stays in the exercise library, just not part of the ladder).

DELETE FROM pattern_progressions WHERE pattern_id = 'mp_horiz_push' AND exercise_id = 'neutral_grip_parallette_pushups';
DELETE FROM progression_rules WHERE exercise_id = 'neutral_grip_parallette_pushups';
UPDATE progression_rules SET next_exercise_id = NULL, notes = 'Bodyweight/parallette ceiling — instability-based progression continues on rings' WHERE exercise_id = 'parallette_pushups';
