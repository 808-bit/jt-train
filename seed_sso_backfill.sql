-- JT.TRAIN — SSO Backfill for real sessions
-- Run: wrangler d1 execute jt-train-db --file=seed_sso_backfill.sql --remote

-- 2026-05-18-A | Full Body A
INSERT OR IGNORE INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES (
  '2026-05-18-A', '2026-05-18', 'Full Body A', 1056, 10, 'stable', 0,
  '["false_grip_ring_rows"]',
  'Address pull rep decay — false grip rows dropped from 12 to 7 across 4 sets. Reduce angle or add a band assist to maintain quality reps.',
  '{"total_volume_kg":1056,"total_sets":10,"performance_signal":"stable","shoulder_flag":false,"exercises_flagged":["false_grip_ring_rows"],"recommendation":"Address pull rep decay — false grip rows dropped from 12 to 7 across 4 sets. Reduce angle or add a band assist to maintain quality reps.","prose":"Double KB front squat held at 44kg for 3×8 — baseline established. Pull pattern is the flag: false grip ring rows decayed from 12 to 7 reps across the session, indicating accumulated fatigue or insufficient recovery between sets. Parallette push volume was consistent. Next session: extend rest on pulling sets or reduce starting reps to a sustainable target."}'
);

-- 2026-05-24-A | Full Body B
INSERT OR IGNORE INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES (
  '2026-05-24-A', '2026-05-24', 'Full Body B', 1776, 11, 'stable', 0,
  '["band_assisted_ring_pull_ups"]',
  'Complete prescribed pull sets next session — only 1 of planned sets logged for band-assisted ring pull-ups.',
  '{"total_volume_kg":1776,"total_sets":11,"performance_signal":"stable","shoulder_flag":false,"exercises_flagged":["band_assisted_ring_pull_ups"],"recommendation":"Complete prescribed pull sets next session — only 1 of planned sets logged for band-assisted ring pull-ups.","prose":"Bulgarian split squat and single-leg RDL both completed at target load — lower body pattern solid at 40kg and 24kg respectively. Ring push-up volume held across 4 sets with minor variance. Pull pattern is incomplete: only 1 set of band-assisted ring pull-ups logged against prescription. Incomplete pull volume is the primary gap this session."}'
);

-- 2026-05-29-A | Full Body A
INSERT OR IGNORE INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES (
  '2026-05-29-A', '2026-05-29', 'Full Body A', 1940, 10, 'stable', 0,
  '["kb_suitcase_rdl","false_grip_ring_rows"]',
  'Complete hinge volume next session — suitcase RDL cut to 2 sets. Row rep decay continuing for second consecutive session.',
  '{"total_volume_kg":1940,"total_sets":10,"performance_signal":"stable","shoulder_flag":false,"exercises_flagged":["kb_suitcase_rdl","false_grip_ring_rows"],"recommendation":"Complete hinge volume next session — suitcase RDL cut to 2 sets. Row rep decay continuing for second consecutive session.","prose":"Double KB front squat consistent at 44kg across 4 sets with minor rep drop on set 4 (8→7) — load is approaching a genuine ceiling. False grip ring rows decayed 14→9 reps across the session for the second consecutive Full Body A. Suitcase RDL was cut short at 2 of planned sets. Two incomplete patterns in one session signals time pressure or fatigue management issue."}'
);

-- 2026-05-31-A | Full Body A
INSERT OR IGNORE INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, shoulder_flag, exercises_flagged, recommendation, raw_json)
VALUES (
  '2026-05-31-A', '2026-05-31', 'Full Body A', 2400, 10, 'improving', 0,
  '[]',
  'Continue progressive overload on double KB deadlift — moved from 44kg to 52kg this session. Standardise set numbering in logging.',
  '{"total_volume_kg":2400,"total_sets":10,"performance_signal":"improving","shoulder_flag":false,"exercises_flagged":[],"recommendation":"Continue progressive overload on double KB deadlift — moved from 44kg to 52kg this session. Standardise set numbering in logging.","prose":"Best volume session to date. Double KB deadlift progressed from 44kg to 52kg mid-session and held for 3 additional sets — clear strength signal. Double KB front squat accumulated high rep volume at 44kg. No incomplete patterns, no shoulder flags. James, the deadlift progression is the data point — next Full Body A, open at 52kg and test whether it holds across all prescribed sets."}'
);
