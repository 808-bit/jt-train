-- JT.TRAIN — Trend test seed
-- Simulates 3 sessions of declining performance on double_kb_front_squat
-- Run: wrangler d1 execute jt-train-db --file=seed_trend_test.sql --remote

-- Seed fake sessions (needed for foreign key)
INSERT OR IGNORE INTO sessions (id, phase_id, date, session_type, location, ai_plan_used)
VALUES
  ('2026-05-19-A', 'lean-bulk-q2-2026', '2026-05-19', 'Full Body A', 'Home', 1),
  ('2026-05-26-A', 'lean-bulk-q2-2026', '2026-05-26', 'Full Body A', 'Home', 1),
  ('2026-06-02-A', 'lean-bulk-q2-2026', '2026-06-02', 'Full Body A', 'Home', 1);

-- Seed declining sets for double_kb_front_squat
-- Session 1: solid — 4 sets, 20+24kg, RIR 1
INSERT OR IGNORE INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo)
VALUES
  ('2026-05-19-A', 'double_kb_front_squat', 1, 10, 44, 1, '3-0-1-0'),
  ('2026-05-19-A', 'double_kb_front_squat', 2, 10, 44, 1, '3-0-1-0'),
  ('2026-05-19-A', 'double_kb_front_squat', 3, 9,  44, 1, '3-0-1-0'),
  ('2026-05-19-A', 'double_kb_front_squat', 4, 8,  44, 2, '3-0-1-0');

-- Session 2: dropping — 3 sets completed, reps falling, RIR creeping
INSERT OR IGNORE INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo)
VALUES
  ('2026-05-26-A', 'double_kb_front_squat', 1, 8, 40, 2, '3-0-1-0'),
  ('2026-05-26-A', 'double_kb_front_squat', 2, 7, 40, 3, '3-0-1-0'),
  ('2026-05-26-A', 'double_kb_front_squat', 3, 6, 40, 3, '3-0-1-0');

-- Session 3: declining further — 2 sets, lighter, high RIR
INSERT OR IGNORE INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo)
VALUES
  ('2026-06-02-A', 'double_kb_front_squat', 1, 6, 36, 3, '3-0-1-0'),
  ('2026-06-02-A', 'double_kb_front_squat', 2, 5, 36, 4, '3-0-1-0');

-- Seed 3 debriefs showing declining trend
INSERT INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES
  ('2026-05-19-A', '2026-05-19', 'Full Body A', 1760, 12, 'stable',   0, '[]',                              'Maintain current load. Monitor double KB front squat volume.', '{}'),
  ('2026-05-26-A', '2026-05-26', 'Full Body A', 1320, 10, 'declining', 0, '["double_kb_front_squat"]',      'Reduce load on double KB front squat. RIR creeping — fatigue accumulating.', '{}'),
  ('2026-06-02-A', '2026-06-02', 'Full Body A', 792,  8,  'declining', 0, '["double_kb_front_squat"]',      'Swap double KB front squat — 3 sessions of volume and rep decay. Regression warranted.', '{}');
