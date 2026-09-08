#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProgram, location, productionSources, relative, root, sourceFileMap, sourceRoots, ts } from './source.mjs';

const allowedHttpPrefixes = ['packages/sdk/', 'services/commerce/src/platform/http/', 'extensions/vendors/', 'tools/localinfra/src/'];
const businessIdentifierPattern = /^[a-z][a-z0-9]*(?:[.:][a-z][a-z0-9]*){1,}$/;
const constantPattern = /^[A-Z][A-Z0-9_]{4,}$/;
const violation = (code, location, detail) => ({ code, location, detail });
const violationKey = (value) => `${value.code}\u0000${value.location}\u0000${value.detail}`;
const pushMap = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);

function propertyPath(node, sourceFile) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isMetaProperty(node)) return node.getText(sourceFile);
  if (ts.isPropertyAccessExpression(node)) {
    const parent = propertyPath(node.expression, sourceFile);
    return parent ? `${parent}.${node.name.text}` : undefined;
  }
  return undefined;
}

function environmentRead(node, sourceFile) {
  if (ts.isPropertyAccessExpression(node)) {
    const parent = propertyPath(node.expression, sourceFile);
    if (parent === 'process.env' || parent === 'import.meta.env') return node.name.text;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    const parent = propertyPath(node.expression, sourceFile);
    if (parent === 'process.env' || parent === 'import.meta.env') return node.argumentExpression.text;
  }
  return undefined;
}

function literalDefault(node, parent, sourceFile) {
  if (parent && ts.isBinaryExpression(parent) && parent.left === node && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(parent.operatorToken.kind)) {
    if (ts.isStringLiteralLike(parent.right) || ts.isNumericLiteral(parent.right) || parent.right.kind === ts.SyntaxKind.TrueKeyword || parent.right.kind === ts.SyntaxKind.FalseKeyword) {
      return parent.right.getText(sourceFile);
    }
  }
  return '<required>';
}

function functionName(node, parent = node.parent, sourceFile) {
  if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))) return node.name.text;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sourceFile);
  return undefined;
}

function bindingNames(name, values) {
  if (ts.isIdentifier(name)) {
    values.push(name.text);
  } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bindingNames(element.name, values);
    }
  }
}

function functionFingerprint(node, sourceFile) {
  if (!node.body || node.body.getWidth(sourceFile) < 120) return undefined;
  const statements = ts.isBlock(node.body) ? node.body.statements.length : 1;
  if (statements < 4) return undefined;
  const names = [];
  for (const parameter of node.parameters ?? []) bindingNames(parameter.name, names);
  const collect = (child) => {
    if (child !== node && ts.isFunctionLike(child)) return;
    if (ts.isVariableDeclaration(child)) bindingNames(child.name, names);
    if (ts.isCatchClause(child) && child.variableDeclaration) bindingNames(child.variableDeclaration.name, names);
    ts.forEachChild(child, collect);
  };
  collect(node.body);
  const canonical = new Map([...new Set(names)].map((name, index) => [name, `LOCAL${index}`]));
  const tokens = [];
  const serialize = (child) => {
    if (ts.isIdentifier(child)) {
      tokens.push(`I:${canonical.get(child.text) ?? child.text}`);
    } else if (ts.isStringLiteralLike(child)) {
      tokens.push(`S:${child.text}`);
    } else if (ts.isNumericLiteral(child)) {
      tokens.push(`N:${child.text}`);
    } else {
      tokens.push(`K:${child.kind}`);
      ts.forEachChild(child, serialize);
    }
  };
  serialize(node.body);
  return {
    hash: crypto.createHash('sha256').update(tokens.join('|')).digest('hex'),
    tokens,
  };
}

function semanticKind(name, sourceName) {
  if (/^(?:can|may|authorize|isAllowed|hasPermission|checkAccess)/.test(name)) return 'permission';
  if (/(?:money|amount|currency|date|time|cursor|page).*?(?:map|format|parse|encode|decode)|(?:map|format|parse|encode|decode).*?(?:money|amount|currency|date|time|cursor|page)/i.test(name)) {
    return 'mapper';
  }
  if (sourceName.startsWith('extensions/vendors/') && /retry/i.test(name)) return 'providerRetry';
  return 'general';
}

function shingles(tokens) {
  const size = 5;
  if (tokens.length < size) return new Set([tokens.join('|')]);
  const values = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    values.add(tokens.slice(index, index + size).join('|'));
  }
  return values;
}

function similarity(left, right) {
  let intersection = 0;
  const [small, large] = left.size < right.size ? [left, right] : [right, left];
  for (const value of small) if (large.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function initializerSignature(node, sourceFile) {
  if (!node) return undefined;
  const text = node.getText(sourceFile).replace(/\s+/g, '');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function businessValues(initializer) {
  if (ts.isStringLiteralLike(initializer)) return [initializer.text];
  if (ts.isArrayLiteralExpression(initializer)) {
    return initializer.elements.filter(ts.isStringLiteralLike).map((element) => element.text);
  }
  return [];
}

function declarationName(node, sourceFile) {
  if (!node.name) return '';
  return ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : node.name.getText(sourceFile);
}

function propertyNameText(name) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : '';
}

function declaresBusinessIdentifier(node, sourceFile) {
  if (ts.isEnumMember(node)) return true;
  if (ts.isPropertyAssignment(node)) return false;
  const name = declarationName(node, sourceFile);
  return /(?:^|_)(?:codes|types|operations|errors|capabilities|events|permissions|catalog|definitions)$/i.test(name) || /(?:Codes|Types|Operations|Errors|Capabilities|Events|Permissions|Catalog|Definitions)$/.test(name);
}

function packageManifests(directory, values) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') packageManifests(target, values);
    } else if (entry.isFile() && entry.name === 'package.json') {
      values.push(target);
    }
  }
}

function dependencyViolations() {
  const manifests = [];
  for (const directory of sourceRoots) packageManifests(directory, manifests);
  const versions = new Map();
  for (const manifest of manifests.sort()) {
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    } catch {
      continue;
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(payload[field] ?? {})) {
        if (typeof version !== 'string' || name.startsWith('@shop/') || name.startsWith('@smart-wing/')) continue;
        if (!versions.has(name)) versions.set(name, new Map());
        pushMap(versions.get(name), version, relative(manifest));
      }
    }
  }
  const values = [];
  for (const [name, byVersion] of [...versions].sort()) {
    if (byVersion.size < 2) continue;
    const detail = [...byVersion]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([version, locations]) => `${version}:${locations.join(',')}`)
      .join(';');
    values.push(violation('DEPENDENCY_VERSION_DRIFT', name, detail));
  }
  return values;
}

export function audit() {
  const sourceList = productionSources();
  const program = createProgram(sourceList);
  const sourceFiles = sourceFileMap(program);
  const values = [];
  const routes = new Map();
  const identifiers = new Map();
  const fingerprints = new Map();
  const functions = [];
  const metrics = new Map();
  const queryKeys = new Map();
  const providerRetries = new Map();
  const environmentDefaults = new Map();

  for (const source of sourceList) {
    const sourceFile = sourceFiles.get(source);
    if (!sourceFile) continue;
    const sourceName = relative(source);
    const visit = (node, parent) => {
      const envKey = environmentRead(node, sourceFile);
      if (envKey) {
        const valueLocation = location(sourceFile, node);
        const defaultValue = literalDefault(node, parent, sourceFile);
        if (!environmentDefaults.has(envKey)) environmentDefaults.set(envKey, new Map());
        pushMap(environmentDefaults.get(envKey), defaultValue, valueLocation);
        if (!sourceName.startsWith('packages/config/src/')) {
          values.push(violation('DUPLICATE_CONFIG_SOURCE', valueLocation, envKey));
        }
      }

      const declaredInitializer = (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isEnumMember(node)) && node.initializer && declaresBusinessIdentifier(node, sourceFile) ? node.initializer : undefined;
      for (const value of declaredInitializer ? businessValues(declaredInitializer) : []) {
        if (businessIdentifierPattern.test(value) || constantPattern.test(value)) pushMap(identifiers, value, location(sourceFile, node));
      }
      if (
        ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) && node.name.text === 'path') || (ts.isStringLiteralLike(node.name) && node.name.text === 'path')) &&
        ts.isStringLiteralLike(node.initializer) &&
        node.initializer.text.startsWith('/') &&
        /(?:route|router|navigation)/i.test(path.basename(source)) &&
        sourceName !== 'packages/config/src/RouteCatalog.ts'
      ) {
        const surface = node.parent && ts.isObjectLiteralExpression(node.parent)
          ? node.parent.properties.find((property) => ts.isPropertyAssignment(property) && propertyNameText(property.name) === 'surface')?.initializer
          : undefined;
        const surfaceName = surface && ts.isStringLiteralLike(surface) ? surface.text : undefined;
        const owner = sourceName.startsWith('apps/') ? sourceName.split('/').slice(0, 2).join('/') : surfaceName ? `global:${surfaceName}` : 'global';
        pushMap(routes, `${owner} PAGE ${node.initializer.text}`, location(sourceFile, node));
      }
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && /querykeys?$/i.test(node.name.text)) {
        const signature = initializerSignature(node.initializer, sourceFile);
        if (signature) pushMap(queryKeys, signature, `${location(sourceFile, node)}:${node.name.text}`);
      }

      if (sourceName.startsWith('extensions/vendors/') && ts.isPropertyAssignment(node) && ((ts.isIdentifier(node.name) && node.name.text === 'retry') || (ts.isStringLiteralLike(node.name) && node.name.text === 'retry'))) {
        const provider = sourceName.split('/')[2] ?? 'unknown';
        const signature = initializerSignature(node.initializer, sourceFile);
        if (signature) pushMap(providerRetries, provider, `${signature}:${location(sourceFile, node)}`);
      }

      if (ts.isCallExpression(node)) {
        const callPath = propertyPath(node.expression, sourceFile);
        const metricFactory = callPath?.split('.').at(-1);
        if (['createCounter', 'createGauge', 'createHistogram', 'defineMetric', 'registerMetric'].includes(metricFactory)) {
          const first = node.arguments[0];
          if (first && ts.isStringLiteralLike(first)) pushMap(metrics, first.text, location(sourceFile, node));
        }
        if (callPath === 'fetch' || callPath === 'globalThis.fetch') {
          if (!allowedHttpPrefixes.some((prefix) => sourceName.startsWith(prefix))) {
            values.push(violation('DIRECT_HTTP_CLIENT', location(sourceFile, node), 'fetch must use @shop/sdk or an infrastructure adapter'));
          }
        }
        if (sourceName.includes('/domain/') && ['Date.now', 'Math.random'].includes(callPath)) {
          values.push(violation('DOMAIN_NONDETERMINISM', location(sourceFile, node), callPath));
        }
        if (ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text.toUpperCase();
          const receiver = propertyPath(node.expression.expression, sourceFile);
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && ['app', 'router'].includes(receiver)) {
            const first = node.arguments[0];
            if (first && ts.isStringLiteralLike(first) && first.text.startsWith('/')) {
              const owner = sourceName.startsWith('apps/') ? sourceName.split('/').slice(0, 2).join('/') : 'global';
              pushMap(routes, `${owner} ${method} ${first.text}`, location(sourceFile, node));
            }
          }
        }
      }

      if (ts.isFunctionLike(node) && node.body && !sourceName.includes('/generated/')) {
        const name = functionName(node, parent, sourceFile);
        const fingerprint = name && functionFingerprint(node, sourceFile);
        if (fingerprint) {
          const valueLocation = `${location(sourceFile, node)}:${name}`;
          const kind = semanticKind(name, sourceName);
          pushMap(fingerprints, fingerprint.hash, { kind, location: valueLocation });
          functions.push({
            hash: fingerprint.hash,
            kind,
            location: valueLocation,
            shingles: shingles(fingerprint.tokens),
            size: fingerprint.tokens.length,
          });
        }
      }
      ts.forEachChild(node, (child) => visit(child, node));
    };
    visit(sourceFile);
  }

  for (const [route, locations] of [...routes].sort()) {
    if (locations.length > 1) values.push(violation('DUPLICATE_ROUTE', route, locations.join(',')));
  }
  for (const [identifier, locations] of [...identifiers].sort()) {
    if (locations.length > 1) {
      values.push(violation('DUPLICATE_BUSINESS_IDENTIFIER', identifier, locations.join(',')));
    }
  }
  for (const [fingerprint, matches] of [...fingerprints].sort()) {
    if (matches.length > 1) {
      const kinds = new Set(matches.map((match) => match.kind));
      const code =
        kinds.size === 1 && kinds.has('permission')
          ? 'DUPLICATE_PERMISSION_DECISION'
          : kinds.size === 1 && kinds.has('mapper')
            ? 'DUPLICATE_MAPPER_LOGIC'
            : kinds.size === 1 && kinds.has('providerRetry')
              ? 'DUPLICATE_PROVIDER_RETRY'
              : 'DUPLICATE_FUNCTION_LOGIC';
      values.push(violation(code, fingerprint.slice(0, 12), matches.map((match) => match.location).join(',')));
    }
  }
  for (let leftIndex = 0; leftIndex < functions.length; leftIndex += 1) {
    const left = functions[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < functions.length; rightIndex += 1) {
      const right = functions[rightIndex];
      if (left.hash === right.hash) continue;
      const ratio = Math.min(left.size, right.size) / Math.max(left.size, right.size);
      if (ratio < 0.8) continue;
      const score = similarity(left.shingles, right.shingles);
      if (score < 0.9) continue;
      const kind = left.kind === right.kind ? left.kind : 'general';
      const code = kind === 'permission' ? 'SIMILAR_PERMISSION_DECISION' : kind === 'mapper' ? 'SIMILAR_MAPPER_LOGIC' : kind === 'providerRetry' ? 'SIMILAR_PROVIDER_RETRY' : 'SIMILAR_FUNCTION_LOGIC';
      values.push(violation(code, score.toFixed(3), `${left.location},${right.location}`));
    }
  }
  for (const [metric, locations] of [...metrics].sort()) {
    if (locations.length > 1) values.push(violation('DUPLICATE_METRIC_DEFINITION', metric, locations.join(',')));
  }
  for (const [signature, locations] of [...queryKeys].sort()) {
    if (locations.length > 1) values.push(violation('DUPLICATE_QUERY_KEY', signature, locations.join(',')));
  }
  for (const [provider, policies] of [...providerRetries].sort()) {
    const signatures = new Set(policies.map((policy) => policy.split(':', 1)[0]));
    if (policies.length > 1) {
      values.push(violation(signatures.size === 1 ? 'DUPLICATE_PROVIDER_RETRY' : 'PROVIDER_RETRY_DRIFT', provider, policies.join(',')));
    }
  }
  for (const [key, defaults] of [...environmentDefaults].sort()) {
    if (defaults.size > 1) {
      const detail = [...defaults]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([defaultValue, locations]) => `${defaultValue}:${locations.join(',')}`)
        .join(';');
      values.push(violation('CONFIG_DEFAULT_DRIFT', key, detail));
    }
  }
  values.push(...dependencyViolations());
  return [...new Map(values.map((value) => [violationKey(value), value])).values()].sort((left, right) => violationKey(left).localeCompare(violationKey(right)));
}

function fingerprintForText(text) {
  const sourceFile = ts.createSourceFile('/tmp/self-test.ts', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let value;
  const visit = (node) => {
    if (!value && ts.isFunctionDeclaration(node)) value = functionFingerprint(node, sourceFile)?.hash;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return value;
}

function selfTest() {
  const first = `function calculate(input) {\n const one = input + 1;\n const two = one * 2;\n const three = two + input;\n const four = three + two + one + input;\n return four + three + one + two + input;\n}`;
  const second = first.replaceAll('one', 'first').replaceAll('two', 'second').replaceAll('three', 'third').replaceAll('four', 'fourth');
  if (!fingerprintForText(first) || fingerprintForText(first) !== fingerprintForText(second)) {
    throw new Error('AST structural fingerprint self-test failed');
  }
  console.log('duplicate-self-test accepted=true parser=typescript');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentsSet = new Set(process.argv.slice(2));
  if (argumentsSet.has('--self-test')) {
    selfTest();
  } else {
    const violations = audit();
    if (argumentsSet.has('--json')) {
      console.log(JSON.stringify(violations, null, 2));
    } else {
      console.log(`duplicate-check accepted=${violations.length === 0} parser=typescript violations=${violations.length}`);
      for (const item of violations) console.log(`${item.code} ${item.location} ${item.detail}`.trim());
    }
    if (violations.length) process.exitCode = 1;
  }
}
