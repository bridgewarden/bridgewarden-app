export const MIN_MASTER_PASSWORD_LENGTH = 12;

export const isMasterPasswordAcceptable = (password: string): boolean => password.length >= MIN_MASTER_PASSWORD_LENGTH;
