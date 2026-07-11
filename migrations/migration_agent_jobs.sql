-- Job table for the async Gerald agent pattern. The Coach's Workout POST now
-- returns a job_id immediately (fast response, never at risk of a client-side
-- fetch timeout) while the actual agent loop runs server-side via
-- ctx.waitUntil() and writes its result here. The frontend polls
-- ?action=getAgentJob&job_id=X with short GET requests instead of holding one
-- long-lived POST open — mobile Safari kills long fetches ("Load failed")
-- well before Gerald's 30-55s multi-iteration tool loop finishes.

CREATE TABLE IF NOT EXISTS agent_jobs (
  id         TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | complete | error
  result     TEXT,                            -- JSON string of { plan, validation }
  error      TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
