-- JT.TRAIN — Trend test seed v2
-- 3 sessions all declining + flagged for double_kb_front_squat
-- Run: wrangler d1 execute jt-train-db --file=seed_trend_test_v2.sql --remote

INSERT OR IGNORE INTO sessions (id, phase_id, date, session_type, location, ai_plan_used)
VALUES
  ('2026-05-19-A', 'lean-bulk-q2-2026', '2026-05-19', 'Full Body A', 'Home', 1),
  ('2026-05-26-A', 'lean-bulk-q2-2026', '2026-05-26', 'Full Body A', 'Home', 1);

INSERT OR IGNORE INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo)
VALUES
  ('2026-05-19-A', 'double_kb_front_squat', 1, 10, 44, 1, '3-0-1-0'),
  ('2026-05-19-A', 'double_kb_front_squat', 2, 9,  44, 2, '3-0-1-0'),
  ('2026-05-19-A', 'double_kb_front_squat', 3, 8,  44, 2, '3-0-1-0'),
  ('2026-05-26-A', 'double_kb_front_squat', 1, 8,  40, 2, '3-0-1-0'),
  ('2026-05-26-A', 'double_kb_front_squat', 2, 7,  40, 3, '3-0-1-0'),
  ('2026-05-26-A', 'double_kb_front_squat', 3, 6,  40, 3, '3-0-1-0');

INSERT INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES
  ('2026-05-19-A', '2026-05-19', 'Full Body A', 1680, 11, 'declining', 0, '["double_kb_front_squat"]', 'Double KB front squat showing early rep decay — monitor next session.', '{}'),
  ('2026-05-26-A', '2026-05-26', 'Full Body A', 1260, 9,  'declining', 0, '["double_kb_front_squat"]', 'Second consecutive decline on double KB front squat — load and reps both dropping. Swap warranted if trend continues.', '{}');
