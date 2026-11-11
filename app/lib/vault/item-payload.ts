import { z } from 'zod';

const name = z.string().trim().min(1).max(200);
const username = z.string().max(254);
const password = z.string().max(1024);
const url = z.string().max(2048);
const notes = z.string().max(50_000);

const customFieldSchema = z.strictObject({
  label: z.string().trim().min(1).max(100),
  value: z.string().max(5000),
  hidden: z.boolean(),
});

export const loginPayloadSchema = z.strictObject({
  type: z.literal('login'),
  name,
  username: username.optional(),
  password: password.optional(),
  urls: z.array(url).max(20).optional(),
  notes: notes.optional(),
  totpSecret: z.string().max(1024).optional(),
  customFields: z.array(customFieldSchema).max(50).optional(),
});

export const notePayloadSchema = z.strictObject({
  type: z.literal('note'),
  name,
  body: z.string().max(50_000),
});

export const folderPayloadSchema = z.strictObject({ name });

export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type NotePayload = z.infer<typeof notePayloadSchema>;
export type FolderPayload = z.infer<typeof folderPayloadSchema>;
export type ItemPayload = LoginPayload | NotePayload;

export const parseItemPayload = (type: 'login' | 'note', value: unknown): ItemPayload | null => {
  const parsed = (type === 'login' ? loginPayloadSchema : notePayloadSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseFolderPayload = (value: unknown): FolderPayload | null => {
  const parsed = folderPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
