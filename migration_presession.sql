-- JT.TRAIN — Pre-session signal columns
-- Run: wrangler d1 execute jt-train-db --file=migration_presession.sql --remote

ALTER TABLE sessions ADD COLUMN pre_sleep INTEGER;
ALTER TABLE sessions ADD COLUMN pre_energy INTEGER;
ALTER TABLE sessions ADD COLUMN pre_soreness INTEGER;
