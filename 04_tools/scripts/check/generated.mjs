import { spawnSync } from 'node:child_process';
import { root } from './source.mjs';

for (const workspace of ['@shop/contractgen', '@shop/requirementgen']) {
  const result = spawnSync('npm', ['run', 'check', '--workspace', workspace], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}
for (const [script, loader] of [['04_tools/scripts/build-web-tokens.mjs', false], ['04_tools/scripts/build-miniapp-theme.mjs', false],
  ['04_tools/scripts/build-miniapp-environment.mjs', true], ['04_tools/scripts/build-miniapp-contract.mjs', true], ['04_tools/scripts/build-runtime-config.mjs', false]]) {
  const result = spawnSync(process.execPath, [...(loader ? ['--import', 'tsx'] : []), script, '--check'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}
console.log('generated artifacts: current');
