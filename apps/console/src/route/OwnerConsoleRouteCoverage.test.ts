// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COMMERCE_OPERATIONS, type OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { workstations, type WorkstationKey } from '../shell/Workstation';
import { professionalRoutes } from './ProfessionalRouteCatalog';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const routerSource = readFileSync(join(repositoryRoot, 'apps/console/src/route/ConsoleRouter.tsx'), 'utf8');
const ownerProjection = readFileSync(
  join(repositoryRoot, 'database/supabase/migrations/20260829210000_owner_operator_coverage.sql'),
  'utf8',
);

const workstationOperations = Object.freeze({
  cockpit: ['reporting.dashboard.read'],
  control: ['runtime.health.dependency'],
  products: ['catalog.listings.read'],
  orders: ['order.orders.read'],
  finance: ['finance.overview.read', 'finance.reconciliations.read', 'finance.audit.read',
    'finance.policies.read', 'finance.policies.preview', 'finance.policies.manage'],
} as const satisfies Readonly<Record<WorkstationKey, readonly OperationId[]>>);

const routeOperationAdditions = Object.freeze({
  'settings/access': [
    'access.ownership.read',
    'access.ownership.transfers.preview',
    'access.ownership.transfers.create',
    'access.ownership.transfers.accept.preview',
    'access.ownership.transfers.accept',
    'access.ownership.transfers.cancel.preview',
    'access.ownership.transfers.cancel',
    'identity.password.verify',
    'identity.mobile.challenge',
    'identity.mobile.manage',
    'identity.stepup.start',
    'identity.stepup.complete',
  ],
  'settings/members': ['identity.invitations.create', 'identity.members.reset'],
} as const satisfies Readonly<Record<string, readonly OperationId[]>>);

const shellOperations = Object.freeze([
  'identity.session.read',
  'identity.session.delete',
  'member.profile.read',
  'organization.layers.read',
] as const satisfies readonly OperationId[]);

describe('Owner Console route and Operation coverage', () => {
  it('maps every concrete Console route to a workstation or professional requirement', () => {
    const paths = businessRoutePaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.map((path) => routeCoverage(path)?.path)).toEqual(paths);
    for (const route of professionalRoutes) {
      expect(paths.some((path) => routeCovers(path, route.suffix))).toBe(true);
    }
  });

  it('keeps the missing product-detail contract as the only explicit static blocker', () => {
    expect(professionalRoutes.filter(({ blocker }) => blocker !== undefined).map(({ suffix, operation, operations, blocker }) => ({
      suffix,
      operation,
      operations,
      blocker,
    }))).toEqual([{
      suffix: 'products/:productId',
      operation: null,
      operations: [],
      blocker: '缺少 catalog.product.detail.read Operation，页面必须 fail-closed。',
    }]);
    for (const path of businessRoutePaths()) {
      const coverage = routeCoverage(path);
      expect(coverage).toBeDefined();
      if (path === 'products/:productId') expect(coverage?.operations).toEqual([]);
      else expect(coverage?.operations.length, path).toBeGreaterThan(0);
    }
  });

  it('requires only registered non-public Operations covered by the Owner projection', () => {
    const catalog = new Map(COMMERCE_OPERATIONS.map((operation) => [operation.id, operation]));
    for (const id of allRequiredOperations()) {
      const operation = catalog.get(id);
      expect(operation, id).toBeDefined();
      expect(operation?.audience, id).not.toBe('public');
      expect(operation?.permission, id).toBeDefined();
    }
    expect(ownerProjection).toMatch(/insert into access\.rolepermission[\s\S]*?where operation\.audience<>'public'[\s\S]*?on conflict do nothing;/);
    expect(ownerProjection).toMatch(/insert into capability\.entitlement\([\s\S]*?where operation\.audience<>'public'[\s\S]*?on conflict\(scope_id,capability_id,effective_at\)/);
    expect(ownerProjection).toMatch(/expected\(operation_id\)[\s\S]*?where operation\.audience<>'public'[\s\S]*?capability\.membership_operations/);
    expect(ownerProjection).toMatch(/create constraint trigger platform_owner_operator_coverage_operation[\s\S]*?on capability\.operation/);
  });

  it('does not leave a contract Operation literal outside the executable checklist', () => {
    const catalogIds = new Set(COMMERCE_OPERATIONS.map(({ id }) => id));
    const declared: ReadonlySet<string> = new Set(allRequiredOperations());
    const referenced = consoleOperationLiterals(catalogIds);
    expect([...referenced].filter((id) => !declared.has(id)).sort()).toEqual([]);
  });
});

function businessRoutePaths(): readonly string[] {
  return [...routerSource.matchAll(/\bpath:\s*'([^']+)'/g)]
    .map((match) => match[1]!)
    .filter((path) => path !== '/' && path !== '/scopes/:scopeKind/:scopeId' && path !== '*');
}

function routeCoverage(path: string): Readonly<{ path: string; operations: readonly OperationId[] }> | undefined {
  const workstation = workstations.find(({ key }) => key === path);
  if (workstation !== undefined) return { path, operations: workstationOperations[workstation.key] };
  const professional = professionalRoutes.find(({ suffix }) => routeCovers(path, suffix));
  if (professional === undefined) return undefined;
  const additions = routeOperationAdditions[professional.suffix as keyof typeof routeOperationAdditions] ?? [];
  return { path, operations: [...professional.operations, ...additions] };
}

function allRequiredOperations(): readonly OperationId[] {
  const routes = businessRoutePaths().flatMap((path) => routeCoverage(path)?.operations ?? []);
  return [...new Set<OperationId>([...shellOperations, ...routes])].sort();
}

function routeCovers(routePath: string, catalogPath: string): boolean {
  const routeSegments = routePath.split('/');
  const catalogSegments = catalogPath.split('/');
  let routeIndex = 0;
  let catalogIndex = 0;
  while (routeIndex < routeSegments.length) {
    const routeSegment = routeSegments[routeIndex]!;
    const optional = routeSegment.startsWith(':') && routeSegment.endsWith('?');
    if (optional && catalogIndex >= catalogSegments.length) {
      routeIndex += 1;
      continue;
    }
    const catalogSegment = catalogSegments[catalogIndex];
    if (catalogSegment === undefined
      || (!routeSegment.startsWith(':') && !catalogSegment.startsWith(':') && routeSegment !== catalogSegment)) return false;
    routeIndex += 1;
    catalogIndex += 1;
  }
  return catalogIndex === catalogSegments.length;
}

function consoleOperationLiterals(catalogIds: ReadonlySet<string>): ReadonlySet<string> {
  const operations = new Set<string>();
  for (const file of productionSources(join(repositoryRoot, 'apps/console/src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['"]([a-z][a-z0-9]*(?:\.[a-z0-9]+)+)['"]/g)) {
      if (match[1] !== undefined && catalogIds.has(match[1])) operations.add(match[1]);
    }
  }
  return operations;
}

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}
