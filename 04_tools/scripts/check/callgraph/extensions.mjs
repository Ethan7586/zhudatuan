import fs from 'node:fs';
import path from 'node:path';

import { relative, root, ts } from '../source.mjs';
import { literalText, objectProperties, unique, violation } from './catalog.mjs';

const providerRoot = path.join(root, '01_core_hexin/extensions/providers');
const vendorRoot = path.join(root, '01_core_hexin/extensions/vendors');
const catalogFile = path.join(root, '01_core_hexin/packages/contract/src/RequirementCatalog.generated.ts');
const registryFile = path.join(root, '01_core_hexin/services/commerce/src/bootstrap/ProviderFactories.ts');
const skeleton = ['manifest.ts', 'Provider.ts', 'Mapper.ts', 'ErrorMap.ts', 'Webhook.ts', 'index.ts'];
const manifestFields = ['id', 'kind', 'priority', 'version', 'apiVersion', 'contractVersion', 'capabilities', 'permissions', 'configSchema', 'eventSubscriptions', 'secretRefs', 'limits'];
const vendorFiles = ['Client.ts', 'Auth.ts', 'Signer.ts', 'RatePolicy.ts', 'CircuitPolicy.ts', 'index.ts'];

function arrayInitializer(sourceFile, variableName) {
  let found;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isArrayLiteralExpression(initializer)) found = initializer;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function objectInitializer(sourceFile, variableName) {
  let found;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) found = initializer;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function unwrap(node) {
  if (ts.isCallExpression(node) && node.arguments.length) return unwrap(node.arguments[0]);
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return unwrap(node.expression);
  return node;
}

function catalog(sourceFiles) {
  const values = [];
  const source = sourceFiles.get(catalogFile);
  if (!source) return { entries: [], violations: [violation('PROVIDER_CATALOG_MISSING', relative(catalogFile), 'PROVIDER_CATALOG_RECORDS')] };
  const array = arrayInitializer(source, 'PROVIDER_CATALOG_RECORDS');
  if (!array) return { entries: [], violations: [violation('PROVIDER_CATALOG_INVALID', relative(catalogFile), 'array initializer missing')] };
  const seen = new Set();
  const entries = [];
  for (const [index, element] of array.elements.entries()) {
    if (!ts.isObjectLiteralExpression(element)) {
      values.push(violation('PROVIDER_CATALOG_ENTRY_INVALID', `${relative(catalogFile)}:${index + 1}`, 'object required'));
      continue;
    }
    const properties = objectProperties(element, source);
    const id = literalText(properties.get('id'));
    if (!unique(values, seen, 'PROVIDER_CATALOG', `${relative(catalogFile)}:${index + 1}`, id)) continue;
    const priorityNode = properties.get('priority');
    const priority = priorityNode && ts.isNumericLiteral(priorityNode) ? Number(priorityNode.text) : undefined;
    const delivery = literalText(properties.get('delivery'));
    const vendor = literalText(properties.get('vendor'));
    if (![1, 3, 4].includes(priority)) values.push(violation('PROVIDER_PRIORITY_INVALID', relative(catalogFile), id));
    if (delivery !== (priority === 1 ? 'required' : 'deferred-contract')) values.push(violation('PROVIDER_DELIVERY_INVALID', relative(catalogFile), id));
    entries.push({ id, priority, delivery, vendor });
  }
  if (entries.length !== 20) values.push(violation('PROVIDER_COUNT_INVALID', relative(catalogFile), `expected=20 actual=${entries.length}`));
  if (entries.filter(({ priority }) => priority === 1).length !== 11) values.push(violation('PROVIDER_P1_COUNT_INVALID', relative(catalogFile), 'expected=11'));
  return { entries, violations: values };
}

export function auditExtensions(sourceFiles) {
  const parsed = catalog(sourceFiles);
  const values = [...parsed.violations];
  const registry = sourceFiles.get(registryFile);
  const registryText = registry?.text ?? '';
  if (!registry) values.push(violation('PROVIDER_REGISTRY_MISSING', relative(registryFile), 'explicit factory registry'));
  const required = parsed.entries.filter(({ delivery }) => delivery === 'required');
  for (const entry of required) {
    const directory = path.join(providerRoot, entry.id);
    for (const file of skeleton) {
      const target = path.join(directory, file);
      if (!sourceFiles.has(target)) values.push(violation('PROVIDER_FILE_MISSING', relative(target), entry.id));
    }
    const manifestFile = path.join(directory, 'manifest.ts');
    const manifestSource = sourceFiles.get(manifestFile);
    const definition = manifestSource && objectInitializer(manifestSource, 'definition');
    if (!manifestSource || !definition) {
      values.push(violation('PROVIDER_MANIFEST_INVALID', relative(manifestFile), entry.id));
    } else {
      const properties = objectProperties(definition, manifestSource);
      for (const field of manifestFields) if (!properties.has(field)) values.push(violation('PROVIDER_FIELD_MISSING', relative(manifestFile), `${entry.id}:${field}`));
      if (literalText(properties.get('id')) !== entry.id) values.push(violation('PROVIDER_ID_MISMATCH', relative(manifestFile), entry.id));
      if (!/function\s+manifest\s*\([^)]*signature/.test(manifestSource.text) || !/\bsignature\b/.test(manifestSource.text)) values.push(violation('PROVIDER_SIGNATURE_INJECTION_MISSING', relative(manifestFile), entry.id));
    }
    if (!registryText.includes(`@shop/provider${entry.id}`)) values.push(violation('PROVIDER_NOT_REGISTERED', relative(registryFile), entry.id));
    const testDirectory = path.join(directory, 'tests');
    const hasTest = fs.existsSync(testDirectory) && fs.readdirSync(testDirectory).some((name) => name.endsWith('.test.ts'));
    if (!hasTest) values.push(violation('PROVIDER_CONTRACT_TEST_MISSING', relative(testDirectory), entry.id));
  }
  for (const entry of parsed.entries.filter(({ delivery }) => delivery === 'deferred-contract')) {
    if (fs.existsSync(path.join(providerRoot, entry.id))) values.push(violation('DEFERRED_PROVIDER_CODE_FORBIDDEN', relative(path.join(providerRoot, entry.id)), entry.id));
  }
  for (const vendor of new Set(required.map(({ vendor }) => vendor).filter(Boolean))) {
    for (const file of vendorFiles) {
      const target = path.join(vendorRoot, vendor, file);
      if (!sourceFiles.has(target)) values.push(violation('VENDOR_FILE_MISSING', relative(target), vendor));
    }
  }
  const hostProvider = path.join(providerRoot, 'core/src/Provider.ts');
  if (!sourceFiles.get(hostProvider)?.text.includes('health()')) values.push(violation('PROVIDER_HEALTH_MISSING', relative(hostProvider), 'host provider health contract'));
  return values;
}
