-- Reps-before-load lever ordering.
--
-- double_kb_front_squat listed "Heavier bells" FIRST, so a stalled lift got the
-- lumpy combo jump (20+24=44kg ±4 -> 20+32=52kg ±12) before anyone tried simply
-- adding reps at 44kg. Reps at that lift never exceeded 9 against a target of 8.
-- Put the rep lever first; leave the load lever available but last.

UPDATE progression_rules
SET intensity_levers = '["Add reps at current bells", "3-0-2-0 tempo", "Pause at bottom", "Heavier bells", "Increase asymmetric load"]'
WHERE exercise_id = 'double_kb_front_squat';
