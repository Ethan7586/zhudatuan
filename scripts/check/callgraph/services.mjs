import path from 'node:path';

import { location, relative, ts } from '../source.mjs';
import { literalText, objectProperties, violation } from './catalog.mjs';

const moduleRoot = 'services/commerce/src/modules/';

export function auditServices(sourceFiles) {
  const tokens = serviceTokens(sourceFiles);
  const values = [];
  for (const [file, sourceFile] of sourceFiles) {
    const name = relative(file);
    if (!name.startsWith(moduleRoot) || path.basename(name) !== 'Module.ts') continue;
    const manifestFile = path.join(path.dirname(file), 'Manifest.ts');
    const manifest = sourceFiles.get(manifestFile);
    if (!manifest) {
      values.push(violation('MODULE_MANIFEST_MISSING', name, relative(manifestFile)));
      continue;
    }
    const declared = manifestServices(manifest);
    if (!declared) {
      values.push(violation('MODULE_SERVICE_CATALOG_INVALID', relative(manifestFile), 'service catalogs must be literal arrays'));
      continue;
    }
    const scopes = serviceScopes(sourceFile);
    visitServiceCalls(sourceFile, (call, identifier) => {
      const service = tokens.get(identifier.text);
      const workload = scopes.get(call);
      if (!service) {
        values.push(violation('MODULE_SERVICE_TOKEN_UNRESOLVED', location(sourceFile, call), identifier.text));
      } else if (!workload) {
        values.push(violation('MODULE_SERVICE_SCOPE_UNRESOLVED', location(sourceFile, call), service));
      } else if (!declared[workload].has(service)) {
        values.push(violation('MODULE_SERVICE_DECLARATION_MISSING', location(sourceFile, call), `${workload}:${service}`));
      }
    });
  }
  return values;
}

function serviceTokens(sourceFiles) {
  const values = new Map();
  const conflicts = new Set();
  for (const [file, sourceFile] of sourceFiles) {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
        const expression = node.initializer.expression;
        if (ts.isIdentifier(expression) && expression.text === 'token') {
          const key = literalText(node.initializer.arguments[0]);
          if (key && values.has(node.name.text) && values.get(node.name.text) !== key) conflicts.add(node.name.text);
          if (key) values.set(node.name.text, key);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  for (const name of conflicts) values.delete(name);
  return values;
}

function manifestServices(sourceFile) {
  let values;
  const visit = (node) => {
    if (values || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'defineModuleManifest') {
      ts.forEachChild(node, visit);
      return;
    }
    const api = literalSet(node.arguments[2]);
    const workloads = node.arguments[3] && ts.isObjectLiteralExpression(node.arguments[3]) ? objectProperties(node.arguments[3], sourceFile) : new Map();
    const jobs = workloadServices(workloads.get('jobs'), sourceFile);
    const provider = workloadServices(workloads.get('provider'), sourceFile);
    values = api && jobs && provider ? { api, jobs, provider } : null;
  };
  visit(sourceFile);
  return values;
}

function literalSet(node) {
  if (!node) return new Set();
  if (!ts.isArrayLiteralExpression(node)) return null;
  const literals = node.elements.map(literalText);
  return literals.every(Boolean) ? new Set(literals) : null;
}

function workloadServices(node, sourceFile) {
  if (!node) return new Set();
  if (!ts.isObjectLiteralExpression(node)) return null;
  return literalSet(objectProperties(node, sourceFile).get('services'));
}

function serviceScopes(sourceFile) {
  const values = new Map();
  const named = new Map();
  const workloadByProperty = new Map([
    ['handlers', 'api'],
    ['ports', 'api'],
    ['jobs', 'jobs'],
    ['jobPorts', 'jobs'],
    ['providerJobs', 'provider'],
    ['providerPorts', 'provider'],
  ]);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineModule' && ts.isObjectLiteralExpression(node.arguments[1])) {
      for (const property of node.arguments[1].properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : undefined;
        const workload = workloadByProperty.get(name);
        if (!workload) continue;
        if (ts.isIdentifier(property.initializer)) named.set(property.initializer.text, workload);
        else collectServiceCalls(property.initializer, workload, values);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body && named.has(statement.name.text)) {
      collectServiceCalls(statement.body, named.get(statement.name.text), values);
    }
  }
  return values;
}

function collectServiceCalls(node, workload, values) {
  const visit = (current) => {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === 'service') {
      values.set(current, workload);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
}

function visitServiceCalls(sourceFile, onCall) {
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'service' &&
      node.arguments.length === 1 &&
      ts.isIdentifier(node.arguments[0])
    ) {
      onCall(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}
