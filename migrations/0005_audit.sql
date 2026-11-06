CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_events_user_time ON audit_events (user_id, created_at);
