import { createAuditEventsQueries, type AuditEvent } from './queries/audit-events';

export type { AuditEvent } from './queries/audit-events';

export const recordAuditEventSafe = async (env: Env, event: AuditEvent): Promise<boolean> => {
  try {
    await createAuditEventsQueries(env).insert(event);
    return true;
  } catch {
    console.warn('auth.audit_failed');
    return false;
  }
};
