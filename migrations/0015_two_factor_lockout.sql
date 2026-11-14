ALTER TABLE users ADD COLUMN two_factor_failed_count INTEGER NOT NULL DEFAULT 0 CHECK (two_factor_failed_count >= 0);
ALTER TABLE users ADD COLUMN two_factor_locked_until INTEGER;
