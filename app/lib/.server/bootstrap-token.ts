import { requireSecret } from './env';

const textEncoder = new TextEncoder();

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
};

export const verifyBootstrapToken = (env: Env, submitted: string): boolean => {
  try {
    const expected = requireSecret(env, 'BOOTSTRAP_TOKEN');
    return constantTimeEqual(textEncoder.encode(expected), textEncoder.encode(submitted));
  } catch {
    return false;
  }
};
