export const safeNextPath = (value: string | null | undefined): string => {
  const fallback = '/app';
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;

  try {
    const url = new URL(value, 'https://app.invalid');
    if (url.origin !== 'https://app.invalid') return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};
