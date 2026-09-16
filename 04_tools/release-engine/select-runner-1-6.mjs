#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import { selectExecutionRunner } from './src/runner-selection-1-6.mjs';

const path = process.argv[2];
let observation;
try {
  observation = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  observation = { error: error.message };
}
process.stdout.write(`${JSON.stringify(selectExecutionRunner(observation))}\n`);
