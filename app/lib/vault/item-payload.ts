import { z } from 'zod';

import {
  MAX_ITEM_CUSTOM_FIELDS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_NOTE_BYTES,
  MAX_ITEM_NOTES_LENGTH,
  MAX_ITEM_PASSWORD_LENGTH,
  MAX_ITEM_URLS,
  MAX_ITEM_USERNAME_LENGTH,
  utf8ByteLength,
} from './limits';

const name = z.string().trim().min(1).max(MAX_ITEM_NAME_LENGTH);
const username = z.string().max(MAX_ITEM_USERNAME_LENGTH);
const password = z.string().max(MAX_ITEM_PASSWORD_LENGTH);
const url = z.string().max(2048);
const notes = z.string().max(MAX_ITEM_NOTES_LENGTH);
const noteBody = z
  .string()
  .refine((value) => utf8ByteLength(value) <= MAX_ITEM_NOTE_BYTES, { message: 'note body too large' });

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
  urls: z.array(url).max(MAX_ITEM_URLS).optional(),
  notes: notes.optional(),
  totpSecret: z.string().max(1024).optional(),
  customFields: z.array(customFieldSchema).max(MAX_ITEM_CUSTOM_FIELDS).optional(),
});

export const notePayloadSchema = z.strictObject({
  type: z.literal('note'),
  name,
  body: noteBody,
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
