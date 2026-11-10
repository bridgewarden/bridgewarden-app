import { toBase64Url } from '../base64-url';
import { hashSessionToken } from './session';

export const createInvitationToken = async (): Promise<{ token: string; tokenHash: string }> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, tokenHash: await hashSessionToken(token) };
};

export const hashInvitationToken = (token: string): Promise<string> => hashSessionToken(token);
