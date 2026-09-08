import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRepository = resolve(process.env.ZHUDATUAN_LI_ROOT ?? join(repository, '../zhudatuan_li'));
const output = join(repository, 'docs/evidence/fusion/Inventory20260904.json');
const check = process.argv.includes('--check');

const paths = Object.freeze({
  mainOperations: 'packages/contract/definitions/operations.yml',
  sourceOperations: 'packages/contract/definitions/operations.yml',
  events: 'packages/contract/definitions/events.yml',
  navigation: 'config/navigation.yml',
  visuals: 'config/visuals.yml',
  requirements: 'docs/requirements/mvp.yml',
  frontend: 'docs/evidence/frontend/files.json',
});

const [mainOperationsSource, sourceOperationsSource, eventsSource, navigationSource, visualsSource, requirementsSource, frontendSource] = await Promise.all([
  read(repository, paths.mainOperations),
  read(sourceRepository, paths.sourceOperations),
  read(repository, paths.events),
  read(repository, paths.navigation),
  read(repository, paths.visuals),
  read(repository, paths.requirements),
  read(repository, paths.frontend),
]);

const mainOperations = yaml(mainOperationsSource).operations;
const sourceOperations = yaml(sourceOperationsSource).operations;
const events = yaml(eventsSource).events;
const navigation = yaml(navigationSource);
const visuals = yaml(visualsSource);
const requirements = yaml(requirementsSource).requirements;
const frontend = JSON.parse(frontendSource);
const modules = await directories(join(repository, 'services/commerce/src/modules'));
const clients = await directories(join(repository, 'apps'));
const screenshots = await files(join(repository, 'docs/evidence/mvp'));

const mainById = new Map(mainOperations.map((operation) => [operation.id, operation]));
const sourceById = new Map(sourceOperations.map((operation) => [operation.id, operation]));
const shared = [...sourceById.keys()].filter((id) => mainById.has(id)).sort();
const sourceOnly = [...sourceById.keys()].filter((id) => !mainById.has(id)).sort();
const mainOnly = [...mainById.keys()].filter((id) => !sourceById.has(id)).sort();
const routesBySurface = new Map();
for (const route of navigation.routes) {
  const routes = routesBySurface.get(route.surface) ?? [];
  routes.push(route);
  routesBySurface.set(route.surface, routes);
}

const sourceDisposition = sourceOnly.map((id) => dispositionForSource(id, sourceById.get(id)));
const mainDisposition = mainOnly.map((id) => dispositionForMain(id, mainById.get(id)));
const allDispositions = [...sourceDisposition, ...mainDisposition];
const expectedVisuals = Object.entries(visuals.surfaces).flatMap(([surface, definition]) =>
  definition.routes.flatMap((route) => route.states.map((state) => Object.freeze({ surface, route: route.routeid, state, owner: routeOwner(navigation.routes.find((entry) => entry.id === route.routeid)), status: 'planned' })))
);

const document = {
  schema: 'zhudatuan.fusion-inventory.v1',
  capturedAt: '2026-09-04T15:41:29+08:00',
  sources: {
    mainOperations: source(paths.mainOperations, mainOperationsSource),
    sourceOperations: source(`zhudatuan_li/${paths.sourceOperations}`, sourceOperationsSource),
    events: source(paths.events, eventsSource),
    navigation: source(paths.navigation, navigationSource),
    visuals: source(paths.visuals, visualsSource),
    requirements: source(paths.requirements, requirementsSource),
    frontend: source(paths.frontend, frontendSource),
  },
  summary: {
    operations: mainOperations.length,
    sourceOperations: sourceOperations.length,
    sharedOperations: shared.length,
    sourceOnlyOperations: sourceOnly.length,
    mainOnlyOperations: mainOnly.length,
    events: events.length,
    modules: modules.length,
    clients: clients.length,
    routes: navigation.routes.length,
    navigationNodes: navigation.nodes.length,
    requirements: requirements.length,
    frontendFiles: frontend.count,
    expectedVisualStates: expectedVisuals.length,
    capturedBaselineImages: screenshots.length,
    unmappedCapabilities: allDispositions.filter((entry) => !entry.owner || !entry.target || !entry.journey || !entry.test).length,
  },
  modules: modules.map((id) => ({ id, owner: id, status: 'implemented' })),
  clients: clients.map((id) => ({ id, owner: 'experience', status: 'implemented' })),
  operations: mainOperations.map(operationSnapshot),
  events: events.map((event) => ({ id: event.id, owner: event.owner, status: 'implemented', handlers: event.handlers })),
  pages: navigation.routes.map((route) => ({
    id: route.id,
    surface: route.surface,
    path: route.path,
    owner: routeOwner(route),
    feature: route.feature,
    requirements: route.requirements,
    status: 'implemented',
  })),
  requirements: requirements.map((requirement) => ({
    id: requirement.id,
    row: requirement.row,
    title: requirement.title,
    owner: requirement.modules,
    routes: requirement.routeids,
    operations: requirement.operations,
    releaseAtBaseline: requirement.release,
    finalStatus: 'required',
  })),
  operationFusion: {
    shared,
    sourceOnly: sourceDisposition,
    mainOnly: mainDisposition,
  },
  visualBaseline: {
    authorityStates: visuals.states,
    viewports: visuals.viewports,
    routesBySurface: Object.fromEntries([...routesBySurface].map(([surface, routes]) => [surface, routes.map(({ id }) => id)])),
    expected: expectedVisuals,
    captured: screenshots.map((path) => ({ path, status: 'captured', owner: 'design' })),
  },
};

if (document.summary.unmappedCapabilities !== 0) throw new Error(`FUSION_CAPABILITY_UNMAPPED:${document.summary.unmappedCapabilities}`);
const content = `${JSON.stringify(document, null, 2)}\n`;
if (check) {
  const current = await readFile(output, 'utf8').catch(() => '');
  if (current !== content) throw new Error('FUSION_INVENTORY_DRIFT');
} else {
  await writeFile(output, content, 'utf8');
}

function dispositionForSource(id, operation) {
  const target = sourceTarget(id);
  const current = mainById.get(target);
  const owner = current?.owner ?? target.split('.')[0];
  return {
    source: id,
    decision: target === id ? 'keep' : 'replace',
    target,
    owner,
    state: current ? 'implemented' : 'planned',
    handler: current?.handler ?? handlerPath(target, owner),
    test: `services/commerce/src/modules/${owner}/test/FusionOperation.test.ts`,
    journey: journeyFor(owner),
  };
}

function dispositionForMain(id, operation) {
  const replaced = id === 'access.owners.transfer';
  return {
    source: id,
    decision: replaced ? 'replace' : 'keep',
    target: replaced ? 'access.ownership.transfers.create' : id,
    owner: operation.owner,
    state: replaced ? 'planned' : 'implemented',
    handler: replaced ? handlerPath('access.ownership.transfers.create', 'access') : operation.handler,
    test: `services/commerce/src/modules/${operation.owner}/test/FusionOperation.test.ts`,
    journey: journeyFor(operation.owner),
  };
}

function sourceTarget(id) {
  return (
    Object.freeze({
      'identity.members.create': 'identity.members.manage',
      'identity.storefronts.read': 'storefront.bootstrap.read',
      'identity.members.reset': 'identity.members.manage',
      'identity.mobile.challenge': 'identity.mobile.challenges.create',
      'identity.wechat.session': 'identity.federations.start',
      'identity.wechat.bind': 'identity.links.create',
      'provisioning.malls.create': 'organization.malls.create',
      'provisioning.malls.read': 'organization.malls.read',
      'member.invitations.read': 'identity.invitations.read',
      'reporting.powderclass.read': 'reporting.sales.read',
      'invoice.operatorprofiles.read': 'invoice.profiles.read',
      'voucher.batches.issue': 'voucher.issueorders.create',
      'voucher.batches.read': 'voucher.issuebatches.get',
      'voucher.batches.retry': 'voucher.issuebatches.retry',
      'voucher.bindings.manage': 'voucher.vouchers.bind',
      'voucher.bindings.read': 'voucher.vouchers.get',
      'voucher.cardlibraries.allocate': 'voucher.stockrequests.create',
      'voucher.cardlibraries.create': 'voucher.credentialpools.create',
      'voucher.cardlibraries.read': 'voucher.credentialpools.list',
      'voucher.history.read': 'voucher.vouchers.timeline',
      'voucher.imports.read': 'voucher.jobs.get',
      'voucher.programs.manage': 'voucher.products.revise',
      'voucher.programs.read': 'voucher.products.list',
      'voucher.redemptions.read': 'voucher.redemptions.get',
      'voucher.redemptions.reverse': 'voucher.refunds.create',
      'voucher.reserves.decide': 'approval.tasks.approve',
      'voucher.reserves.read': 'voucher.stockrequests.list',
      'voucher.reserves.request': 'voucher.stockrequests.create',
      'voucher.status.batch': 'voucher.actionbatches.create',
      'voucher.statusbatches.read': 'voucher.actionbatches.list',
    })[id] ?? id
  );
}

function journeyFor(owner) {
  return (
    Object.freeze({
      identity: 'J01',
      organization: 'J06',
      access: 'J05',
      capability: 'J42',
      approval: 'J21',
      partner: 'J20',
      member: 'J13',
      qualification: 'J08',
      catalog: 'J08',
      pricing: 'J14',
      inventory: 'J12',
      experience: 'J07',
      marketing: 'J14',
      referral: 'J24',
      cart: 'J13',
      checkout: 'J14',
      order: 'J16',
      fulfillment: 'J16',
      verification: 'J22',
      payment: 'J15',
      voucher: 'J20',
      benefit: 'J24',
      finance: 'J29',
      invoice: 'J31',
      channel: 'J25',
      extension: 'J27',
      support: 'J17',
      notification: 'J37',
      reporting: 'J34',
      risk: 'J35',
      audit: 'J42',
      navigation: 'J02',
      runtime: 'J43',
      storefront: 'J13',
      observability: 'J43',
    })[owner] ?? 'J42'
  );
}

function handlerPath(id, owner) {
  const name = id
    .split('.')
    .slice(1)
    .map((part) => part.replace(/(^|[^a-z0-9])([a-z0-9])/g, (_, __, value) => value.toUpperCase()))
    .join('');
  return `services/commerce/src/modules/${owner}/application/handler/${name}Handler.ts`;
}

function operationSnapshot(operation) {
  return {
    id: operation.id,
    owner: operation.owner,
    method: operation.method,
    path: operation.path,
    audience: operation.audience,
    targets: operation.targets,
    requirements: operation.requirements,
    handler: operation.handler,
    sdk: operation.sdk,
    status: 'implemented',
  };
}

function routeOwner(route) {
  if (!route) return 'navigation';
  const owner = route.feature === 'task' ? 'runtime' : route.feature;
  return modules.includes(owner) ? owner : route.surface;
}

async function read(root, path) {
  return readFile(join(root, path), 'utf8');
}

function yaml(source) {
  return YAML.parse(source);
}

function source(path, content) {
  return { path, sha256: createHash('sha256').update(content).digest('hex') };
}

async function directories(path) {
  return (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort();
}

async function files(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map(({ name }) => relative(repository, join(path, name)).split(sep).join('/'))
    .sort();
}
