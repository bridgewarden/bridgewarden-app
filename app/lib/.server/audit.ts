export type AuditEvent = {
  type: string;
  userId?: string | null;
  metadata?: string | null;
  createdAt?: number;
};

export const recordAuditEvent = async (db: D1Database, event: AuditEvent): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO audit_events (id, user_id, type, ip_hash, ua_hash, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.userId ?? null,
      event.type,
      null,
      null,
      event.metadata ?? null,
      event.createdAt ?? Date.now(),
    )
    .run();
};
