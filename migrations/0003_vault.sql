CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name_ct TEXT NOT NULL,
  name_iv TEXT NOT NULL,
  data_version INTEGER NOT NULL CHECK (data_version >= 1),
  rev INTEGER NOT NULL CHECK (rev >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_folders_user ON folders (user_id);

CREATE TABLE vault_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id TEXT,
  folder_id TEXT REFERENCES folders (id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('login', 'note')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  data_ct TEXT NOT NULL,
  data_iv TEXT NOT NULL,
  data_version INTEGER NOT NULL CHECK (data_version >= 1),
  rev INTEGER NOT NULL CHECK (rev >= 0),
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_vault_items_user_rev ON vault_items (user_id, rev);
CREATE INDEX idx_vault_items_user_deleted ON vault_items (user_id, deleted_at);
CREATE INDEX idx_vault_items_user_folder ON vault_items (user_id, folder_id);
CREATE INDEX idx_vault_items_user_type ON vault_items (user_id, type);
