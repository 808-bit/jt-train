-- Adds an explicit per-exercise logging mode so the set logger no longer relies
-- on the hardcoded DOUBLE_KB_IDS / PER_ARM_IDS arrays in equipment.js.
--
-- Modes:
--   standard   — one weight field (barbell, single KB held bilaterally, bodyweight)
--   unilateral — one weight field + L/R side toggle, logged one arm/leg at a time
--                (each prescribed set produces 2 logged rows: L then R)
--   dual_kb    — two weight fields (KB 1 + KB 2) held simultaneously, load summed
--
-- bilateral alone cannot distinguish these: kb_farmers_carry and kb_floor_press
-- are both bilateral=0 yet need dual_kb vs unilateral respectively.

ALTER TABLE exercises ADD COLUMN logging_mode TEXT DEFAULT 'standard';

-- Two kettlebells held at once (load summed across both bells).
UPDATE exercises SET logging_mode = 'dual_kb' WHERE id IN (
  'double_kb_front_squat','double_kb_deadlift','double_kb_swing',
  'double_kb_clean','racked_squat','kb_renegade_row','kb_farmers_carry'
);

-- kb_floor_press: one bell, one arm at a time (was wrongly forced into dual mode).
UPDATE exercises SET logging_mode = 'unilateral' WHERE id = 'kb_floor_press';

-- Preserve existing behaviour: every other bilateral=0 exercise already rendered
-- the L/R side toggle (slSide), so it is unilateral by definition.
UPDATE exercises SET logging_mode = 'unilateral'
  WHERE bilateral = 0 AND logging_mode = 'standard';
