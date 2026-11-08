export type AuditEvent = {
  type: string;
  userId: string;
  createdAt: number;
};

export const recordAuditEvent = async (db: D1Database, event: AuditEvent): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO audit_events (id, user_id, type, ip_hash, ua_hash, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), event.userId, event.type, null, null, null, event.createdAt)
    .run();
};
