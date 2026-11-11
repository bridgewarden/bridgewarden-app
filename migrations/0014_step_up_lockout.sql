ALTER TABLE users ADD COLUMN step_up_failed_count INTEGER NOT NULL DEFAULT 0 CHECK (step_up_failed_count >= 0);
ALTER TABLE users ADD COLUMN step_up_locked_until INTEGER;
