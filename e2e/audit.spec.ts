import { test } from '@playwright/test';

import { expectAuditEvent, readAuditEvents } from './audit';
import { queryD1 } from './d1';
import { E2E_ADMIN, E2E_MEMBER } from './fixtures';

test('records the required audit events without sensitive metadata', () => {
  const events = readAuditEvents();
  const users = queryD1<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email IN ('${E2E_ADMIN.email}', '${E2E_MEMBER.email}')`,
  );
  const adminId = users.find((user) => user.email === E2E_ADMIN.email)?.id;
  const memberId = users.find((user) => user.email === E2E_MEMBER.email)?.id;
  if (!adminId || !memberId) throw new Error('expected E2E users');

  expectAuditEvent(events, 'bootstrap.created', { userId: adminId, metadata: null, count: 1 });
  expectAuditEvent(events, 'login.succeeded', { userId: adminId });
  expectAuditEvent(events, 'login.failed', { userId: adminId });
  expectAuditEvent(events, 'logout', { userId: adminId, metadata: null });

  expectAuditEvent(events, '2fa.enrollment_started', { userId: adminId });
  expectAuditEvent(events, '2fa.enrolled', { userId: adminId, count: 1 });
  expectAuditEvent(events, '2fa.backup_code_used', { userId: adminId });
  expectAuditEvent(events, '2fa.verified', { userId: adminId });
  expectAuditEvent(events, '2fa.failed', { userId: adminId });
  expectAuditEvent(events, '2fa.disabled', { userId: adminId });

  expectAuditEvent(events, 'admin.invitation_created', { userId: adminId });
  expectAuditEvent(events, 'admin.invitation_revoked', { userId: adminId, count: 1 });
  expectAuditEvent(events, 'admin.role_changed', { userId: adminId });
  expectAuditEvent(events, 'admin.sessions_revoked', { userId: adminId, count: 1 });
  expectAuditEvent(events, 'admin.user_disabled', { userId: adminId, count: 1 });
  expectAuditEvent(events, 'member.setup_completed', { userId: memberId, count: 1 });

  expectAuditEvent(events, 'password.changed', { userId: adminId });
  expectAuditEvent(events, 'recovery.completed', { userId: adminId });
  expectAuditEvent(events, 'item.purged', { userId: adminId, metadata: null });
});
