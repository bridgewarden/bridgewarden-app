export const isSameOrigin = (request: Request, appOrigin?: string, allowRequestOrigin = false): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  if (allowRequestOrigin && origin === new URL(request.url).origin) return true;
  if (!appOrigin) return false;

  try {
    return new URL(appOrigin).origin === origin;
  } catch {
    return false;
  }
};
