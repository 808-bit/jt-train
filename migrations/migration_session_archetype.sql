-- Session archetype layer: each session is anchored by a theme that shapes which
-- pattern group dominates and the overall RIR/volume character. Read back by
-- assess_training_state's archetype_rotation signal to keep Power in rotation
-- (~every 3 sessions) and Restoration from vanishing (~every 10, readiness-gated).
--   strength     — default; 8 main patterns, RIR 1-2 (existing behaviour)
--   power        — mp_power_conditioning anchored (swings/cleans/snatches), RIR 2-3
--   restoration  — mp_rehab anchored, high RIR, longer holds / low load
ALTER TABLE sessions ADD COLUMN archetype TEXT;
