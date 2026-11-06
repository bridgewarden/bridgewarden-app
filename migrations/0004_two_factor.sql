CREATE TABLE user_2fa (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  totp_secret_ct TEXT NOT NULL,
  totp_secret_iv TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_totp_step INTEGER NOT NULL DEFAULT 0 CHECK (last_totp_step >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE backup_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_backup_codes_user_used ON backup_codes (user_id, used_at);
