/**
 * Module boundary and dependency direction audit.
 *
 * Backend (section 12.4): interface -> application -> domain <- port, infrastructure
 *   domain never imports application, infrastructure or interface.
 *   application never imports infrastructure or interface.
 *   no module reaches into another module's internals.
 *
 * Frontend (section 12.3): app -> route/shell -> feature -> entity -> shared
 *   no reverse import, no cross-feature deep import, no direct fetch.
 */
import { sourceFiles, read, rel, imports, resolveRelativeImport } from './workspace.mjs';

const BACKEND_LAYER = /services\/[^/]+\/src\/modules\/([^/]+)\/(domain|application|infrastructure|interface|01_public_gongkai|02_domain_yewu|03_application_yingyong|04_adapters_shixian|05_interface_jieru)\//;
const BACKEND_MODULE = /services\/[^/]+\/src\/modules\/([^/]+)\/(.+)$/;
const FRONTEND_LAYER = /apps\/[^/]+\/src\/(app|route|shell|feature|entity|shared)\//;

const BACKEND_LAYER_NAME = {
  '01_public_gongkai': 'public',
  '02_domain_yewu': 'domain',
  '03_application_yingyong': 'application',
  '04_adapters_shixian': 'infrastructure',
  '05_interface_jieru': 'interface',
};

const BACKEND_FORBIDDEN = {
  domain: ['application', 'infrastructure', 'interface'],
  application: ['infrastructure', 'interface'],
  infrastructure: ['interface'],
  interface: [],
};

const FRONTEND_RANK = { shared: 0, entity: 1, feature: 2, shell: 3, route: 3, app: 4 };

export function auditBoundaries() {
  const findings = [];

  for (const file of sourceFiles()) {
    const path = rel(file);
    if (path.includes('.test.')) continue;
    const source = read(file);

    const backend = path.match(BACKEND_LAYER);
    const backendModule = path.match(BACKEND_MODULE);
    if (backendModule) {
      const moduleName = backendModule[1];
      const layer = backend ? (BACKEND_LAYER_NAME[backend[2]] ?? backend[2]) : undefined;
      for (const specifier of imports(source)) {
        const target = specifier.startsWith('.') ? resolveRelativeImport(file, specifier) : null;
        const targetPath = target ? rel(target) : specifier;

        const targetBackend = targetPath.match(BACKEND_LAYER);
        const targetModuleFile = targetPath.match(BACKEND_MODULE);
        if (targetModuleFile && targetModuleFile[1] !== moduleName) {
          const publicRoot = targetModuleFile[2] === 'index.ts'
            || (!targetModuleFile[2].includes('/') && targetModuleFile[2].endsWith('Module.ts'));
          if (!publicRoot) findings.push({ kind: 'crossmodule', file: path,
            detail: `${moduleName} -> ${targetModuleFile[1]}/${targetModuleFile[2]} must use target Module root` });
          continue;
        }
        if (targetBackend) {
          const [, targetModule, rawTargetLayer] = targetBackend;
          const targetLayer = BACKEND_LAYER_NAME[rawTargetLayer] ?? rawTargetLayer;
          if (targetModule !== moduleName) {
            findings.push({ kind: 'crossmodule', file: path, detail: `${moduleName} -> ${targetModule}/${targetLayer} internal` });
          } else if (layer && BACKEND_FORBIDDEN[layer].includes(targetLayer)) {
            findings.push({ kind: 'layer', file: path, detail: `${layer} must not import ${targetLayer}` });
          }
        }
      }
      if (layer === 'domain') {
        if (/\bfetch\s*\(/.test(source)) findings.push({ kind: 'domainio', file: path, detail: 'fetch in domain layer' });
        if (/new Date\s*\(\s*\)/.test(source)) findings.push({ kind: 'domainio', file: path, detail: 'new Date() in domain layer; inject Clock' });
        if (/Math\.random\s*\(/.test(source)) findings.push({ kind: 'domainio', file: path, detail: 'Math.random() in domain layer' });
      }
    }

    const frontend = path.match(FRONTEND_LAYER);
    if (frontend) {
      const layer = frontend[1];
      const rank = FRONTEND_RANK[layer];
      for (const specifier of imports(source)) {
        if (!specifier.startsWith('.')) continue;
        const target = resolveRelativeImport(file, specifier);
        if (!target) continue;
        const targetPath = rel(target);
        const targetFrontend = targetPath.match(FRONTEND_LAYER);
        if (!targetFrontend) continue;
        const targetLayer = targetFrontend[1];
        if (FRONTEND_RANK[targetLayer] > rank) {
          findings.push({ kind: 'layer', file: path, detail: `${layer} must not import ${targetLayer}` });
        }
        if (layer === 'feature' && targetLayer === 'feature') {
          const own = path.split('/feature/')[1]?.split('/')[0];
          const other = targetPath.split('/feature/')[1]?.split('/')[0];
          if (own && other && own !== other) {
            findings.push({ kind: 'crossfeature', file: path, detail: `feature/${own} -> feature/${other}` });
          }
        }
      }
      if (layer !== 'shared' && /\bfetch\s*\(/.test(source)) {
        findings.push({ kind: 'directfetch', file: path, detail: 'direct fetch; only 01_core_hexin/packages/sdk may reach transport' });
      }
    }
  }

  return findings;
}

if (process.argv[1]?.endsWith('boundary.mjs')) {
  const findings = auditBoundaries();
  const byKind = new Map();
  for (const finding of findings) {
    if (!byKind.has(finding.kind)) byKind.set(finding.kind, []);
    byKind.get(finding.kind).push(finding);
  }
  for (const [kind, group] of [...byKind].sort()) {
    console.log(`\n[${kind}] ${group.length}`);
    for (const finding of group.slice(0, 30)) console.log(`  ${finding.file}  ${finding.detail}`);
    if (group.length > 30) console.log(`  ... ${group.length - 30} more`);
  }
  console.log(`\nboundary findings: ${findings.length}`);
  process.exit(findings.length > 0 ? 1 : 0);
}
