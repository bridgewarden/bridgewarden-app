import { z } from 'zod';

import {
  DEFAULT_GENERATOR_PREFERENCES,
  type GeneratorPreferences,
  PASSPHRASE_MAX_WORDS,
  PASSPHRASE_MIN_WORDS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './generator';
import { getVaultEpoch, openVaultDb } from './vault/local-db';

const passwordSchema = z
  .strictObject({
    mode: z.literal('password'),
    length: z.number().int().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    uppercase: z.boolean(),
    lowercase: z.boolean(),
    digits: z.boolean(),
    symbols: z.boolean(),
    excludeAmbiguous: z.boolean(),
  })
  .refine((value) => value.uppercase || value.lowercase || value.digits || value.symbols);

const passphraseSchema = z.strictObject({
  mode: z.literal('passphrase'),
  words: z.number().int().min(PASSPHRASE_MIN_WORDS).max(PASSPHRASE_MAX_WORDS),
  separator: z.enum(['-', '.', '_', ' ']),
  capitalize: z.boolean(),
});

const preferencesSchema = z.strictObject({
  mode: z.enum(['password', 'passphrase']),
  password: passwordSchema,
  passphrase: passphraseSchema,
});

export const getGeneratorPreferences = async (): Promise<GeneratorPreferences> => {
  try {
    const db = await openVaultDb();
    const record = await db.get('meta', 'generator');
    const parsed = record ? preferencesSchema.safeParse(record.preferences) : null;
    return parsed?.success ? parsed.data : DEFAULT_GENERATOR_PREFERENCES;
  } catch {
    return DEFAULT_GENERATOR_PREFERENCES;
  }
};

export const setGeneratorPreferences = async (preferences: GeneratorPreferences): Promise<void> => {
  try {
    const epoch = getVaultEpoch();
    const db = await openVaultDb();
    if (getVaultEpoch() !== epoch) return;
    await db.put('meta', { key: 'generator', preferences });
  } catch {
    // Preferences are non-critical; generation continues with the in-memory options.
  }
};
