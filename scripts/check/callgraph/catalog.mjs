import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

import { relative, root, ts } from '../source.mjs';

export const violation = (code, location, detail) => ({ code, location, detail });
export const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

export function readCatalog(relativeName, keys, required = true) {
  const file = path.join(root, relativeName);
  if (!fs.existsSync(file)) {
    return {
      entries: undefined,
      file,
      violations: required ? [violation('CATALOG_MISSING', relativeName, keys[0])] : [],
    };
  }
  let payload;
  try {
    payload = parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { entries: [], file, violations: [violation('CATALOG_INVALID', relativeName, error.message)] };
  }
  const entries = Array.isArray(payload) ? payload : keys.map((key) => payload?.[key]).find(Array.isArray);
  return entries ? { entries, file, violations: [] } : { entries: [], file, violations: [violation('CATALOG_INVALID', relativeName, `${keys.join('/')} must be an array`)] };
}

export function target(values, code, location, id, field, sourceSet, options = {}) {
  const fields = asArray(field);
  if (fields.length !== 1 || typeof fields[0] !== 'string' || !fields[0]) {
    values.push(violation(`${code}_EDGE_INVALID`, location, `${id}:${options.name ?? 'target'}:expected exactly one`));
    return;
  }
  const file = path.resolve(root, fields[0]);
  if (!sourceSet.has(file) && !(fs.existsSync(file) && fs.statSync(file).isFile())) {
    values.push(violation(`${code}_TARGET_MISSING`, location, `${id}:${options.name ?? 'target'}:${fields[0]}`));
    return;
  }
  if (options.bind !== false && !sourceReferencesId(file, id)) {
    values.push(violation(`${code}_NOT_BOUND`, relative(file), id));
  }
}

export function sourceReferencesId(file, id) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  let found = false;
  const visit = (node) => {
    if (found) return;
    if ((ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.includes(id)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function idOf(entry, names) {
  return names.map((name) => entry?.[name]).find((value) => typeof value === 'string' && value);
}

export function unique(values, seen, code, location, id) {
  if (!id) {
    values.push(violation(`${code}_ID_MISSING`, location, 'id'));
    return false;
  }
  if (seen.has(id)) values.push(violation(`${code}_DUPLICATE`, location, id));
  seen.add(id);
  return true;
}

export function objectProperties(object, sourceFile) {
  const values = new Map();
  for (const property of object.properties) {
    if (!property.name) continue;
    const name = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : property.name.getText(sourceFile);
    if (ts.isPropertyAssignment(property)) values.set(name, property.initializer);
    if (ts.isShorthandPropertyAssignment(property)) values.set(name, property.name);
  }
  return values;
}

export const literalText = (node) => (node && ts.isStringLiteralLike(node) ? node.text : undefined);
