export const MAX_ITEM_NAME_LENGTH = 256;
export const MAX_ITEM_USERNAME_LENGTH = 256;
export const MAX_ITEM_PASSWORD_LENGTH = 1024;
export const MAX_ITEM_URLS = 10;
export const MAX_ITEM_CUSTOM_FIELDS = 20;
export const MAX_ITEM_NOTE_BYTES = 50 * 1024;
export const MAX_ITEM_NOTES_LENGTH = 50_000;
export const MAX_ITEM_CIPHERTEXT_BYTES = 80 * 1024;
export const MAX_ITEM_CIPHERTEXT_BASE64_LENGTH = 4 * Math.ceil(MAX_ITEM_CIPHERTEXT_BYTES / 3);

export const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).length;
