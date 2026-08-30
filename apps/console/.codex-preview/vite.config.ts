import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Connect } from 'vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const session = {
  actor: 'user:vi-compare-admin',
  membership: 'membership:platform-admin',
  scope: {
    kind: 'platform',
    id: 'platform:preview',
    name: '智慧翼福利商城平台',
  },
  scopes: [
    {
      kind: 'platform',
      id: 'platform:preview',
      name: '智慧翼福利商城平台',
    },
  ],
  accessVersion: 12,
  permissions: ['access.center.read'],
  capabilities: ['access.center.read'],
  assurance: { level: 2, verified: 'password' },
  target: 'console',
  syncedAt: '2026-08-28T09:00:00.000Z',
};

const profile = {
  display_name: '本地主 VI 对照管理员',
  employee_no: 'VI-COMPARE-001',
};

const accessCenter = {
  items: [
    {
      id: 'membership:platform-admin',
      status: 'active',
      access_version: 12,
      roles: [{ role: 'platform_admin', name: '平台管理员' }],
      scopes: [
        { id: 'grant:platform', kind: 'platform', scope: 'platform:preview', effect: 'allow', expires: null },
        { id: 'deny:finance-export', kind: 'capability', scope: 'finance.export', effect: 'deny', expires: null },
      ],
    },
    {
      id: 'membership:group-operator',
      status: 'active',
      access_version: 8,
      roles: [{ role: 'group_operator', name: '集团运营' }],
      scopes: [
        { id: 'grant:group', kind: 'enterprise', scope: 'enterprise:smart-wing', effect: 'allow', expires: null },
        { id: 'grant:mall', kind: 'mall', scope: 'mall:welfare', effect: 'allow', expires: null },
      ],
    },
    {
      id: 'membership:store-manager',
      status: 'active',
      access_version: 5,
      roles: [{ role: 'store_manager', name: '店铺负责人' }],
      scopes: [
        { id: 'grant:store', kind: 'store', scope: 'store:shanghai-01', effect: 'allow', expires: null },
      ],
    },
    {
      id: 'membership:auditor',
      status: 'suspended',
      access_version: 3,
      roles: [{ role: 'access_auditor', name: '权限审计员' }],
      scopes: [
        { id: 'grant:audit', kind: 'platform', scope: 'platform:preview', effect: 'allow', expires: '2026-09-30T23:59:59.000Z' },
      ],
    },
  ],
  count: 4,
};

function json(value: unknown): Connect.NextHandleFunction {
  return (_request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(value));
  };
}

function mockApi(): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const route = request.method === 'GET' ? pathname : '';
    if (route === '/api/v1/identity/session') return json(session)(request, response, next);
    if (route === '/api/v1/members/me') return json(profile)(request, response, next);
    if (route === '/api/v1/access/center') return json(accessCenter)(request, response, next);
    next();
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [
    {
      name: 'codex-vi-compare-api',
      configureServer(server) {
        server.middlewares.use(mockApi());
      },
    },
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: true,
    hmr: false,
    watch: null,
  },
});
