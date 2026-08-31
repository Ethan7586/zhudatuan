import { resolve } from 'node:path';
import { generateNavigation } from './NavigationGenerator';

const mode = process.argv[2];
if (mode !== 'generate' && mode !== 'check') throw new Error('NAVIGATION_COMMAND_INVALID');
const result = await generateNavigation(resolve(import.meta.dirname, '../../..'), mode === 'check');
process.stdout.write(`navigation ${mode} passed (${result.nodes} nodes, ${result.hash})\n`);
