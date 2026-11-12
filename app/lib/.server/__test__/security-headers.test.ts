import { describe, expect, it } from 'vitest';

import { applySecurityHeaders, buildContentSecurityPolicy, createSecurityNonce } from '../security-headers';

const production = { APP_ORIGIN: 'https://app.example', APP_ENV: 'production' } as Env;
const development = { APP_ORIGIN: 'http://localhost:8787', APP_ENV: 'development' } as Env;

describe('security headers', () => {
  it('creates unique nonces', () => {
    const first = createSecurityNonce();
    const second = createSecurityNonce();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(16);
  });

  it('keeps scripts nonce-only and allows only style attributes', () => {
    const policy = buildContentSecurityPolicy('abc123', false);

    expect(policy).toContain("script-src 'self' 'nonce-abc123'");
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain("style-src-elem 'self' 'sha256-");
    expect(policy).toContain("object-src 'none'");
  });

  it('allows Vite inline styles and websockets only in development', () => {
    const policy = buildContentSecurityPolicy('dev', true);

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain('ws://localhost:*');
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('adds hardening headers and HSTS to HTTPS production documents', () => {
    const request = new Request('https://app.example/login');
    const response = applySecurityHeaders(
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      request,
      production,
      'nonce-value',
    );

    expect(response.headers.get('content-security-policy')).toContain("'nonce-nonce-value'");
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('omits CSP from API responses but keeps other hardening and no-store', () => {
    const response = applySecurityHeaders(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      new Request('https://app.example/api/vault'),
      production,
      'nonce-value',
    );

    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('omits HSTS outside production or HTTPS', () => {
    const dev = applySecurityHeaders(
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
      new Request('http://localhost:8787/login'),
      development,
      'nonce',
    );
    const http = applySecurityHeaders(
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
      new Request('http://app.example/login'),
      production,
      'nonce',
    );

    expect(dev.headers.get('strict-transport-security')).toBeNull();
    expect(http.headers.get('strict-transport-security')).toBeNull();
  });
});
