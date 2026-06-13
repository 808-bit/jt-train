-- ── Real session duration ──────────────────────────────────────────────────────
-- Captured from the live session timer (start → end-of-session save), in minutes.
-- Powers the longevity "resistance minutes/week" metric. Where this is null
-- (historical sessions, or a reload that lost the timer), analytics fall back to
-- the set-timestamp span: MAX(logged_at) - MIN(logged_at) over the session's sets.
ALTER TABLE sessions ADD COLUMN duration_min REAL;
