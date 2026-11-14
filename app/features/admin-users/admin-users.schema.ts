import { z } from 'zod';

export const inviteSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'member']),
});

export const roleSchema = z.strictObject({ role: z.enum(['admin', 'member']) });

export const userIdSchema = z.string().trim().min(1).max(64);
export const invitationIdSchema = z.uuid();
