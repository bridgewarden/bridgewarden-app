import { expect } from '@playwright/test';

import { queryD1 } from './d1';

const EVENT_TYPE = /^[a-z0-9_.]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Keep in sync with the production allowlist in app/lib/.server/audit.ts.
const ALLOWED_METADATA_KEYS = new Set(['targetUserId', 'invitationId']);

export type AuditRow = {
  type: string;
  user_id: string | null;
  metadata: string | null;
};

const assertSafeMetadata = (metadata: string | null) => {
  if (metadata === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    throw new Error('audit metadata is not JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('audit metadata is not an object');
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) throw new Error(`unexpected audit metadata key: ${key}`);
    if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`unsafe audit metadata value for ${key}`);
  }
};

export const readAuditEvents = (): AuditRow[] => {
  const rows = queryD1<AuditRow>('SELECT type, user_id, metadata FROM audit_events');
  for (const row of rows) assertSafeMetadata(row.metadata);
  return rows;
};

export const expectAuditEvent = (
  rows: AuditRow[],
  type: string,
  options: { userId: string; metadata?: string | null; count?: number },
): void => {
  if (!EVENT_TYPE.test(type)) throw new Error(`invalid audit event type: ${type}`);

  const scoped = rows.filter((row) => row.type === type && row.user_id === options.userId);
  expect(scoped.length, `missing audit event ${type} for ${options.userId}`).toBeGreaterThan(0);
  if (options.count !== undefined) {
    expect(scoped.length, `unexpected ${type} count for ${options.userId}`).toBe(options.count);
  }
  if (options.metadata !== undefined) {
    expect(
      scoped.some((row) => (row.metadata ?? null) === options.metadata),
      `unexpected ${type} metadata for ${options.userId}`,
    ).toBe(true);
  }
};
