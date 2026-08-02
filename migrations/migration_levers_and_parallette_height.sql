-- 1. Intensity levers for the two lifts that are genuinely rep-plateaued.
--
-- Both clear their 3x8 target and have already ridden reps well past it
-- (deadlift to 14, clean to 12) at an unchanged load, so reps-first is spent and
-- they need real levers. Both had intensity_levers NULL, leaving Gerald with a
-- stall flag and nothing sanctioned to reach for.
--
-- double_kb_deadlift is also at 56kg (24+32) — the heaviest total the owned
-- 16/20/24/32 singles can build — and next_exercise_id is NULL, so load and
-- exercise-advance are both exhausted. Tempo, pause, deficit and unilateral are
-- the remaining routes. Deficit is from a step; single-leg RDL already exists as
-- its own exercise (single_leg_kb_rdl) so the pattern is established.

UPDATE progression_rules
SET intensity_levers = '["Add reps at current bells", "3-2-1-0 tempo", "2s pause below the knee", "Deficit from a step", "Single-leg RDL variation"]'
WHERE exercise_id = 'double_kb_deadlift';

-- double_kb_clean is ballistic, so tempo on the ascent makes no sense — the
-- controllable phases are the rack hold and the drop.
UPDATE progression_rules
SET intensity_levers = '["Add reps at current bells", "2s pause in the rack", "Slower controlled drop", "Heavier bells once reps plateau"]'
WHERE exercise_id = 'double_kb_clean';

-- 2. Parallette height tagging.
--
-- The equipment column only ever held the bare string 'Parallettes', so the
-- filters' 'Parallettes (high)' / '(low)' branches were unreachable and every
-- parallette movement passed regardless of which pair is owned. Tag the ones
-- that genuinely need the tall pair. This mirrors exactly what buildKitString()
-- already asserts in its low-only note: "do NOT prescribe parallette dips or
-- L-sit". Everything else stays bare 'Parallettes' = works on either height.

UPDATE exercises SET equipment = 'Parallettes (high)'      WHERE id = 'parallette_dips';
UPDATE exercises SET equipment = 'Parallettes (high)'      WHERE id = 'parallette_l_sit';
UPDATE exercises SET equipment = 'Parallettes (high)+BW'   WHERE id = 'l_sit';
