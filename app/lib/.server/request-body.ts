export const MAX_JSON_BODY_BYTES = 256 * 1024;

export type JsonBodyResult =
  { ok: true; value: unknown } | { ok: false; reason: 'invalid' | 'too-large' | 'unsupported' };

export const readJsonBody = async (request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<JsonBodyResult> => {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return { ok: false, reason: 'unsupported' };
  }

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: 'too-large' };
  }

  if (!request.body) {
    return { ok: false, reason: 'invalid' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: 'too-large' };
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};
