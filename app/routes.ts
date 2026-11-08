import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('health', 'routes/health.tsx'),
  route('login', 'routes/login.tsx'),
  route('setup', 'routes/setup.tsx'),
  route('auth/prelogin', 'routes/auth-prelogin.ts'),
  route('auth/login', 'routes/auth-login.ts'),
  route('auth/logout', 'routes/auth-logout.ts'),
  route('auth/2fa', 'routes/auth-2fa.ts'),
  route('api/account/2fa/enroll', 'routes/api-account-2fa-enroll.ts'),
  route('api/account/2fa/verify', 'routes/api-account-2fa-verify.ts'),
  route('api/account/2fa/disable', 'routes/api-account-2fa-disable.ts'),
  route('api/account/2fa/backup-codes/regenerate', 'routes/api-account-2fa-regenerate.ts'),
  layout('routes/protected.tsx', [
    route('app', 'routes/vault-list.tsx'),
    route('app/trash', 'routes/vault-trash.tsx'),
    route('app/settings', 'routes/settings.tsx'),
  ]),
] satisfies RouteConfig;
