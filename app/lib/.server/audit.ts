import { z } from 'zod';

import { createAuditEventsQueries, type AuditEvent } from './queries/audit-events';

export type { AuditEvent } from './queries/audit-events';

const metadataSchema = z.strictObject({
  targetUserId: z.uuid().optional(),
  invitationId: z.uuid().optional(),
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

export const recordAuditEventSafe = async (env: Env, event: AuditEvent): Promise<boolean> => {
  try {
    await createAuditEventsQueries(env).insert({
      ...event,
      metadata: safeMetadata(event.metadata),
    });
    return true;
  } catch {
    console.warn('auth.audit_failed', event.type);
    return false;
  }
};

export const recordAuditEventsSafe = async (env: Env, events: AuditEvent[]): Promise<boolean> => {
  if (events.length === 0) return true;
  try {
    await createAuditEventsQueries(env).insertMany(
      events.map((event) => ({ ...event, metadata: safeMetadata(event.metadata) })),
    );
    return true;
  } catch {
    console.warn('auth.audit_failed', events.length);
    return false;
  }
};
