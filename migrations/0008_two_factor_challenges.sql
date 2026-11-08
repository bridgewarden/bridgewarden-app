CREATE TABLE two_factor_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at INTEGER
);

CREATE INDEX idx_two_factor_challenges_user ON two_factor_challenges (user_id, expires_at);
