import { hmacSha256, toHex } from './hmac';

export type RequestFingerprints = {
  uaHash: string | null;
  ipHash: string | null;
};

export const fingerprintRequest = async (request: Request, secret: string): Promise<RequestFingerprints> => {
  const userAgent = request.headers.get('user-agent');
  const ip = request.headers.get('cf-connecting-ip');

  return {
    uaHash: userAgent ? toHex(await hmacSha256(secret, `ua:${userAgent}`)) : null,
    ipHash: ip ? toHex(await hmacSha256(secret, `ip:${ip}`)) : null,
  };
};
