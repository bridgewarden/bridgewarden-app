import { getDatabase } from '../db';

export type AuditEvent = {
  type: string;
  userId: string | null;
  createdAt: number;
  uaHash?: string | null;
  ipHash?: string | null;
  metadata?: string | null;
};

export const insertAuditEvent = (db: D1Database, event: AuditEvent): Promise<D1Result> =>
  db
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

export const createAuditEventsQueries = (env: Env) => {
  const db = getDatabase(env);
  return { insert: (event: AuditEvent) => insertAuditEvent(db, event) };
};
