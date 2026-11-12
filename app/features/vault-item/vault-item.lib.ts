import { t } from '~/lib/i18n/en';
import type { DecryptedItemDetail } from '~/lib/vault/item-read';
import type { ItemPayload } from '~/lib/vault/item-payload';
import {
  MAX_ITEM_CIPHERTEXT_BASE64_LENGTH,
  MAX_ITEM_CUSTOM_FIELDS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_NOTE_BYTES,
  MAX_ITEM_NOTES_LENGTH,
  MAX_ITEM_PASSWORD_LENGTH,
  MAX_ITEM_URLS,
  MAX_ITEM_USERNAME_LENGTH,
  utf8ByteLength,
} from '~/lib/vault/limits';

import type { CustomFieldForm, EditorErrors, EditorType, EditorValues } from './vault-item.types';

export const emptyValues = (type: EditorType = 'login'): EditorValues => ({
  type,
  name: '',
  folderId: '',
  favorite: false,
  username: '',
  password: '',
  urls: [''],
  notes: '',
  totpSecret: '',
  customFields: [],
  body: '',
});

export const emptyField = (): CustomFieldForm => ({ label: '', value: '', hidden: false });

export const normalizeTotpSecret = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

export const isValidTotpSecret = (value: string): boolean => {
  const normalized = normalizeTotpSecret(value);
  if (normalized === '') return true;
  return /^[A-Z2-7]+=*$/.test(normalized) && normalized.replace(/=+$/, '').length >= 8;
};

export const valuesFromItem = (item: DecryptedItemDetail): EditorValues => {
  const base = emptyValues(item.type);
  if (item.payload.type === 'login') {
    return {
      ...base,
      name: item.payload.name,
      folderId: item.folderId ?? '',
      favorite: item.favorite,
      username: item.payload.username ?? '',
      password: item.payload.password ?? '',
      urls: item.payload.urls?.length ? [...item.payload.urls] : [''],
      notes: item.payload.notes ?? '',
      totpSecret: item.payload.totpSecret ?? '',
      customFields: (item.payload.customFields ?? []).map((field) => ({ ...field })),
    };
  }
  return {
    ...base,
    type: 'note',
    name: item.payload.name,
    folderId: item.folderId ?? '',
    favorite: item.favorite,
    body: item.payload.body,
  };
};

export const valuesSnapshot = (values: EditorValues): string => JSON.stringify(values);

export const buildPayload = (values: EditorValues): ItemPayload | null => {
  const name = values.name.trim();
  if (name === '') return null;
  if (values.type === 'login') {
    const urls = values.urls.map((url) => url.trim()).filter(Boolean);
    const fields = values.customFields
      .map((field) => ({ ...field, label: field.label.trim() }))
      .filter((field) => field.label !== '' || field.value !== '');
    const totpSecret = normalizeTotpSecret(values.totpSecret);
    return {
      type: 'login',
      name,
      ...(values.username ? { username: values.username } : {}),
      ...(values.password ? { password: values.password } : {}),
      ...(urls.length ? { urls } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
      ...(totpSecret ? { totpSecret } : {}),
      ...(fields.length ? { customFields: fields } : {}),
    };
  }
  return { type: 'note', name, body: values.body };
};

export const validateValues = (values: EditorValues): EditorErrors => {
  const errors: EditorErrors = {};
  if (values.name.trim() === '') errors.name = t('vaultItem.error.nameRequired');
  else if (values.name.trim().length > MAX_ITEM_NAME_LENGTH) errors.name = t('vaultItem.error.nameTooLong');

  if (values.type === 'login') {
    if (values.username.trim() === '') errors.username = t('vaultItem.error.usernameRequired');
    else if (values.username.length > MAX_ITEM_USERNAME_LENGTH) errors.username = t('vaultItem.error.usernameTooLong');
    if (values.password === '') errors.password = t('vaultItem.error.passwordRequired');
    else if (values.password.length > MAX_ITEM_PASSWORD_LENGTH) errors.password = t('vaultItem.error.passwordTooLong');
    const urlCount = values.urls.filter((url) => url.trim() !== '').length;
    if (urlCount === 0) errors.urls = t('vaultItem.error.urlsRequired');
    else if (urlCount > MAX_ITEM_URLS) errors.urls = t('vaultItem.error.urls', { count: MAX_ITEM_URLS });
    if (values.customFields.length > MAX_ITEM_CUSTOM_FIELDS)
      errors.customFields = t('vaultItem.error.fields', { count: MAX_ITEM_CUSTOM_FIELDS });
    if (values.notes.length > MAX_ITEM_NOTES_LENGTH) errors.notes = t('vaultItem.error.notesTooLong');
    if (values.urls.some((url) => url.length > 2048)) errors.urls = t('vaultItem.error.urlTooLong');
    if (values.customFields.some((field) => field.label.length > 100 || field.value.length > 5000)) {
      errors.customFields = t('vaultItem.error.fieldTooLong');
    }
    if (!isValidTotpSecret(values.totpSecret)) errors.totpSecret = t('vaultItem.error.totp');
    if (values.customFields.some((field) => field.label.trim() === '' && field.value !== '')) {
      errors.customFields = t('vaultItem.error.fieldLabel');
    }
  } else if (utf8ByteLength(values.body) > MAX_ITEM_NOTE_BYTES) {
    errors.body = t('vaultItem.error.noteTooLarge');
  }
  return errors;
};

export const hasErrors = (errors: EditorErrors): boolean => Object.keys(errors).length > 0;

export const withinCiphertextBudget = (ciphertextBase64: string): boolean =>
  ciphertextBase64.length <= MAX_ITEM_CIPHERTEXT_BASE64_LENGTH;
