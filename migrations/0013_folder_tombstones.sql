ALTER TABLE folders ADD COLUMN deleted_at INTEGER;
CREATE INDEX idx_folders_user_deleted ON folders (user_id, deleted_at);
