import { getDatabase } from '../db';

export type AuditEvent = {
  type: string;
  userId: string | null;
  createdAt: number;
  uaHash?: string | null;
  ipHash?: string | null;
  metadata?: string | null;
};

const auditStatement = (db: D1Database, event: AuditEvent): D1PreparedStatement =>
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
      event.metadata ?? null,
      event.createdAt,
    );

export const insertAuditEvent = (db: D1Database, event: AuditEvent): Promise<D1Result> =>
  auditStatement(db, event).run();

export const insertAuditEvents = (db: D1Database, events: AuditEvent[]): Promise<D1Result[]> =>
  db.batch(events.map((event) => auditStatement(db, event)));

export const createAuditEventsQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    insert: (event: AuditEvent) => insertAuditEvent(db, event),
    insertMany: (events: AuditEvent[]) => insertAuditEvents(db, events),
  };
};
