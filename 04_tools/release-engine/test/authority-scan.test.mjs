import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const executable = /\.(?:[cm]?[jt]sx?|sh|ya?ml|json)$/;
const ignored = /^(?:05_docs_ziliao\/|.*\/node_modules\/|.*\/dist\/|01_core_hexin\/apps\/console\/public\/design-references\/|04_tools\/release-engine\/test\/authority-scan\.test\.mjs$)/;
const forbidden = [
  /["']lane["']\s*:/i,
  /\blane\s*(?:===?|!==?|<=?|>=?)/i,
  /\b(?:if|switch)\s*\([^)]*\blane\b/i,
  /\bA[0-3]\b.{0,80}\b(?:deploy|build|test|candidate|artifact|authorize|permission)/i,
  /\b(?:deploy|build|test|candidate|artifact|authorize|permission)\b.{0,80}\bA[0-3]\b/i,
  /\b(?:requiredLane|fallbackTarget|productionDisabledReason)\b/,
  /external\s+A3/i,
];

test('current executable files contain no retired release-level authority', async () => {
  const { stdout } = await execFileAsync('git', ['ls-files', '-co', '--exclude-standard'], { maxBuffer: 20 * 1024 * 1024 });
  const findings = [];
  for (const path of stdout
    .trim()
    .split('\n')
    .filter((entry) => executable.test(entry) && !ignored.test(entry))) {
    let source;
    try {
      source = await readFile(path, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const pattern of forbidden) if (pattern.test(source)) findings.push(`${path}: ${pattern}`);
  }
  assert.deepEqual(findings, []);
});
