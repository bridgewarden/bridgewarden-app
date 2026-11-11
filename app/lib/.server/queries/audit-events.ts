import { z } from 'zod';

import { getDatabase } from '../db';

const metadataSchema = z.strictObject({
  targetUserId: z.string().min(1).max(64).optional(),
  invitationId: z.string().min(1).max(64).optional(),
});

const safeMetadata = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = metadataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? JSON.stringify(parsed.data) : null;
  } catch {
    return null;
  }
};

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
      safeMetadata(event.metadata),
      event.createdAt,
    )
    .run();

export const createAuditEventsQueries = (env: Env) => {
  const db = getDatabase(env);
  return { insert: (event: AuditEvent) => insertAuditEvent(db, event) };
};
