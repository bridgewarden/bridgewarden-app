export type AuditEvent = {
  type: string;
  userId: string | null;
  createdAt: number;
  uaHash?: string | null;
  ipHash?: string | null;
};

export const recordAuditEvent = async (db: D1Database, event: AuditEvent): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO audit_events (id, user_id, type, ip_hash, ua_hash, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.userId,
      event.type,
      event.ipHash ?? null,
      event.uaHash ?? null,
      null,
      event.createdAt,
    )
    .run();
};

export const recordAuditEventSafe = async (db: D1Database, event: AuditEvent): Promise<boolean> => {
  try {
    await recordAuditEvent(db, event);
    return true;
  } catch {
    console.warn('auth.audit_failed');
    return false;
  }
};
