import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const policy = parse(readFileSync(join(root, 'config/licenses.yml'), 'utf8'));
const allowed = new Set(policy.allowed);
const denied = policy.denied.map((value) => new RegExp(`(^|[^A-Z])${value}([^A-Z]|$)`, 'i'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const findings = [];

function isAllowedLicense(expression) {
  if (allowed.has(expression)) return true;
  const licenses = expression
    .replace(/[()]/g, ' ')
    .split(/\s+(?:AND|OR)\s+/i)
    .map((license) => license.trim())
    .filter(Boolean);
  return licenses.length > 1 && licenses.every((license) => allowed.has(license));
}

for (const [path, value] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith('node_modules/') || value.link || value.version === undefined) continue;
  const license = value.license;
  if (typeof license !== 'string' || !license.trim()) findings.push(`LICENSE_MISSING ${path}`);
  else if (!isAllowedLicense(license) || denied.some((pattern) => pattern.test(license))) findings.push(`LICENSE_DENIED ${path} ${license}`);
}

const textExtensions = new Set(['.cjs', '.css', '.env', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.mts', '.pem', '.sh', '.sql', '.ts', '.tsx', '.txt', '.wxml', '.wxss', '.yaml', '.yml']);
const secretFileExtensions = new Set(['.jks', '.key', '.keystore', '.p12', '.pem', '.pfx']);
const ignored = new Set(['.git', '.next', '.open-next', 'archive', 'coverage', 'deliverables', 'dist', 'node_modules', 'pre-contract-code-merge-20260820', 'smart-wing-branch-work']);
const signatures = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}\r?\n-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['ALIYUN_ACCESS_KEY', /\bLTAI[A-Za-z0-9]{16,}\b/],
  ['GITHUB_TOKEN', /\bgh[ps]_[A-Za-z0-9]{30,}\b/],
  ['OPENAI_KEY', /\bsk-[A-Za-z0-9_-]{32,}\b/],
  ['DATABASE_PASSWORD', /(?:postgres(?:ql)?:\/\/)[^\s:@/${}()]+:[^\s@/${}()]{8,}@/i],
];

function repositoryFiles() {
  const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root });
  return output.toString('utf8').split('\0').filter(Boolean);
}

for (const path of repositoryFiles()) {
  if (path.split('/').some((segment) => ignored.has(segment))) continue;
  const target = join(root, path);
  if (!existsSync(target) || !statSync(target).isFile()) continue;
  const extension = extname(path).toLowerCase();
  if (secretFileExtensions.has(extension) && !path.includes('/test') && !path.includes('.test.') && !path.includes('.spec.')) findings.push(`SECRET_FILE ${path}`);
  if (!textExtensions.has(extension) || statSync(target).size > 5_000_000) continue;
  const source = readFileSync(target, 'utf8');
  for (const [code, pattern] of signatures) if (pattern.test(source)) findings.push(`${code} ${path}`);
  if (/^[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|PRIVATE_KEY)\s*=\s*[^\s#][^\r\n]{7,}$/m.test(source) && !path.endsWith('.example') && !path.includes('/test') && !path.includes('.test.') && !path.includes('.spec.'))
    findings.push(`PLAINTEXT_SECRET_ASSIGNMENT ${path}`);
}

if (findings.length > 0) {
  console.error(`supply-chain policy failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log(`supply-chain policy: licenses=${Object.keys(lock.packages ?? {}).length} secret findings=0`);
