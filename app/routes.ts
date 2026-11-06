import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('health', 'routes/health.tsx'),
  route('login', 'routes/login.tsx'),
  route('setup', 'routes/setup.tsx'),
  layout('routes/protected.tsx', [route('app', 'routes/vault-list.tsx'), route('app/trash', 'routes/vault-trash.tsx')]),
] satisfies RouteConfig;
