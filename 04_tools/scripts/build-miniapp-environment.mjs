import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { MINIAPP_ENVIRONMENT_SCHEMA } from '../../01_core_hexin/packages/config/src/MiniappEnvironment.ts';

const root = resolve(import.meta.dirname, '../..');
const target = join(root, '01_core_hexin/apps/miniapp/miniprogram/config/Environment.js');
const schema = JSON.stringify(MINIAPP_ENVIRONMENT_SCHEMA, null, 2);
const output = `// Generated from @shop/config MiniappEnvironment. Do not edit.\nconst schema = ${schema};\n\n/** @typedef {{apiBaseUrl: string, mallId: string, clientVersion: string}} MiniappEnvironment */\n/** @param {Readonly<Record<string, unknown>>} source @returns {Readonly<MiniappEnvironment>} */\nfunction environment(source) {\n  const values = /** @type {Record<string, string>} */ ({});\n  for (const field of schema) {\n    const value = source[field.key];\n    if (typeof value !== 'string' || !new RegExp(field.pattern, 'i').test(value)) throw new Error(field.code);\n    values[field.key] = value;\n  }\n  return Object.freeze({ apiBaseUrl: String(values.apiBaseUrl).replace(/\\\/$/, ''), mallId: String(values.mallId), clientVersion: String(values.clientVersion) });\n}\n\nmodule.exports = { environment };\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('MINIAPP_ENVIRONMENT_GENERATED_DRIFT');
} else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, output, 'utf8'); }
