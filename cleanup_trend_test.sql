-- JT.TRAIN — Remove trend test seed data
-- Run: wrangler d1 execute jt-train-db --file=cleanup_trend_test.sql --remote

DELETE FROM debriefs WHERE session_id IN ('2026-05-19-A', '2026-05-26-A');
DELETE FROM sets WHERE session_id IN ('2026-05-19-A', '2026-05-26-A');
DELETE FROM sessions WHERE id IN ('2026-05-19-A', '2026-05-26-A');
