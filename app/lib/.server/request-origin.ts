export const isSameOrigin = (request: Request, appOrigin?: string, allowRequestOrigin = false): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const requestOrigin = new URL(request.url).origin;
  const targetOrigin = allowRequestOrigin ? requestOrigin : appOrigin;
  if (!targetOrigin) return false;

  try {
    const target = new URL(targetOrigin);
    if (target.origin !== origin) return false;

    const host = request.headers.get('host');
    return host === null || host === target.host;
  } catch {
    return false;
  }
};
