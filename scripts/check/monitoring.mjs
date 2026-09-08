import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const document = (file) => parse(read(file));
const catalog = document('infrastructure/monitoring/Catalog.yml');
const dashboards = document('infrastructure/monitoring/Dashboard.yml');
const rules = document('infrastructure/monitoring/Alerts.yml');
const telemetry = document('config/telemetry.yml');
const clients = document('config/clients.yml').clients.map(({ id }) => id);
const operationIds = [...read('packages/contract/src/OperationIds.ts').matchAll(/export const OP_[A-Z0-9_]+ = "([a-z][a-z0-9.]*)" as const;/g)].map((match) => match[1]);
const jobIds = ['services/commerce/src/pipeline/CoreJobCatalog.ts', 'services/commerce/src/pipeline/WorkflowJobCatalog.ts']
  .flatMap((file) => [...read(file).matchAll(/\bid: '([a-z][a-z0-9]*)'/g)].map((match) => match[1]));
const providerMatch = read('packages/contract/src/RequirementCatalog.ts').match(/PROVIDER_CATALOG_RECORDS = Object\.freeze\((\[.*\]) as const\);/);
if (providerMatch === null) fail('PROVIDER_AUTHORITY_UNREADABLE');
const providerIds = JSON.parse(providerMatch[1]).filter(({ delivery }) => delivery === 'required').map(({ id }) => id);
const moduleIds = readdirSync(join(root, 'services/commerce/src/modules'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, 'services/commerce/src/modules', entry.name, 'Module.ts')))
  .map(({ name }) => name);

if (catalog.version !== 2 || catalog.owner !== 'reliability' || catalog.purpose !== 'operational-observability-only') fail('CATALOG_HEADER_INVALID');
if (operationIds.length < 300 || new Set(operationIds).size !== operationIds.length || catalog.coverage?.operations?.selection !== 'every') fail('OPERATION_RED_COVERAGE_INVALID');
if (jobIds.length < 50 || new Set(jobIds).size !== jobIds.length || catalog.coverage?.jobs?.selection !== 'every') fail('JOB_RED_COVERAGE_INVALID');
if (providerIds.length !== 11 || catalog.coverage?.providers?.selection !== 'every-required') fail('PROVIDER_RED_COVERAGE_INVALID');
if (moduleIds.length < 30 || catalog.coverage?.modules?.selection !== 'every') fail('MODULE_RED_USE_COVERAGE_INVALID');
if (clients.join(',') !== 'auth,console,storefront,miniapp,store,supplier' || catalog.coverage?.surfaces?.selection !== 'every') fail('SURFACE_RED_COVERAGE_INVALID');
for (const kind of ['operations', 'jobs', 'providers', 'modules', 'surfaces']) {
  const coverage = catalog.coverage?.[kind];
  if (!coverage?.red || !Array.isArray(coverage.labels) || coverage.labels.length === 0) fail(`RED_DEFINITION_MISSING:${kind}`);
}
for (const kind of ['modules', 'resources']) if (!catalog.coverage?.[kind]?.use) fail(`USE_DEFINITION_MISSING:${kind}`);

const forbidden = new Set(catalog.cardinality?.forbidden ?? []);
const allowed = new Set(catalog.cardinality?.allowed ?? []);
if (forbidden.size < 10 || allowed.size < 10 || [...forbidden].some((label) => allowed.has(label))) fail('CARDINALITY_POLICY_INVALID');
for (const coverage of Object.values(catalog.coverage ?? {})) {
  if ((coverage.labels ?? []).some((label) => forbidden.has(label) || !allowed.has(label))) fail('COVERAGE_LABEL_INVALID');
}
if ((catalog.cardinality?.exemplars ?? []).join(',') !== 'traceid,correlationid') fail('EXEMPLAR_POLICY_INVALID');

const businessSignals = Object.keys(catalog.businessResults ?? {});
if (businessSignals.length !== 10) fail('BUSINESS_RESULT_COVERAGE_INVALID');
const requiredDashboards = catalog.dashboards?.required ?? [];
const dashboardIds = dashboards.dashboards?.map(({ id }) => id) ?? [];
if (requiredDashboards.length !== 8 || requiredDashboards.some((id) => !dashboardIds.includes(id))) fail('DASHBOARD_COVERAGE_INVALID');
const clientDashboard = dashboards.dashboards.find(({ id }) => id === 'clients');
if (clientDashboard?.repeat?.exact?.join(',') !== clients.join(',')) fail('CLIENT_DASHBOARD_COVERAGE_INVALID');
for (const dashboard of dashboards.dashboards ?? []) {
  if (!dashboard.owner || !dashboard.runbook || !existsSync(join(root, dashboard.runbook)) || !Array.isArray(dashboard.panels) || dashboard.panels.length < 6) fail(`DASHBOARD_INVALID:${dashboard.id}`);
}

const requiredAlerts = catalog.alerts?.required ?? [];
if (requiredAlerts.length !== 10 || requiredAlerts.some((id) => telemetry.alerts?.[id] === undefined)) fail('ALERT_COVERAGE_INVALID');
const alertFields = rules.generator?.require ?? [];
for (const field of ['owner', 'runbook', 'dashboard', 'recentChanges', 'traceQuery', 'mitigation']) if (!alertFields.includes(field)) fail(`ALERT_BUILD_GATE_MISSING:${field}`);
for (const [id, alert] of Object.entries(telemetry.alerts ?? {})) {
  if (!alert.owner || !alert.runbook || !existsSync(join(root, alert.runbook))) fail(`ALERT_RUNBOOK_INVALID:${id}`);
  if (!dashboardIds.includes(alert.dashboard)) fail(`ALERT_DASHBOARD_INVALID:${id}`);
  if (![alert.recentChanges, alert.traceQuery, alert.mitigation].every((value) => typeof value === 'string' && value.length > 0)) fail(`ALERT_CONTEXT_INVALID:${id}`);
}
if (telemetry.export?.redactionOrder !== 'before-buffer-and-export' || telemetry.export?.onRedactionFailure !== 'drop-and-alert' || telemetry.export?.piiAllowed !== false) fail('PII_EXPORT_GATE_INVALID');
if (telemetry.sampling?.errors !== 1 || telemetry.sampling?.critical !== 1 || telemetry.sampling?.highrisk !== 1 || telemetry.sampling?.slow !== 1) fail('TRACE_SAMPLING_INVALID');
if (telemetry.retention?.highRiskTraceDays < telemetry.retention?.errorTraceDays || telemetry.retention?.securityLogDays < telemetry.retention?.operationalLogDays) fail('RETENTION_POLICY_INVALID');

const metricDocs = read('docs/metrics/catalog.md');
const alertDocs = read('docs/alerts/catalog.md');
for (const signal of Object.values(catalog.businessResults)) if (!metricDocs.includes(`\`${signal}\``)) fail(`METRIC_DOCUMENTATION_MISSING:${signal}`);
for (const id of Object.keys(telemetry.alerts)) if (!alertDocs.includes(`\`${id}\``)) fail(`ALERT_DOCUMENTATION_MISSING:${id}`);

console.log(`monitoring contract: ${operationIds.length} operations, ${jobIds.length} jobs, ${providerIds.length} providers, ${moduleIds.length} modules, ${clients.length} surfaces, ${requiredAlerts.length} release-blocking alert classes`);

function fail(code) {
  throw new Error(code);
}
