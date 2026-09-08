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

try {
  const audit = JSON.parse(execFileSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], { cwd: root, encoding: 'utf8', timeout: 60_000 }));
  if ((audit?.metadata?.vulnerabilities?.critical ?? 0) > 0 || (audit?.metadata?.vulnerabilities?.high ?? 0) > 0) findings.push('VULNERABILITY_THRESHOLD_EXCEEDED');
} catch (error) {
  const output = typeof error?.stdout === 'string' ? error.stdout : '';
  try {
    const audit = JSON.parse(output);
    if ((audit?.metadata?.vulnerabilities?.critical ?? 0) > 0 || (audit?.metadata?.vulnerabilities?.high ?? 0) > 0) findings.push('VULNERABILITY_THRESHOLD_EXCEEDED');
    else findings.push('VULNERABILITY_AUDIT_UNAVAILABLE');
  } catch {
    findings.push('VULNERABILITY_AUDIT_UNAVAILABLE');
  }
}

function isAllowedLicense(expression) {
  if (allowed.has(expression)) return true;
  return evaluate(expression.trim());
}

function evaluate(expression) {
  const normalized = unwrap(expression.trim());
  const alternatives = split(normalized, 'OR');
  if (alternatives.length > 1) return alternatives.some(evaluate);
  const requirements = split(normalized, 'AND');
  if (requirements.length > 1) return requirements.every(evaluate);
  return allowed.has(normalized) && !denied.some((pattern) => pattern.test(normalized));
}

function unwrap(expression) {
  let value = expression;
  while (value.startsWith('(') && value.endsWith(')') && balanced(value.slice(1, -1))) value = value.slice(1, -1).trim();
  return value;
}

function split(expression, operator) {
  const values = [];
  let depth = 0;
  let start = 0;
  const pattern = new RegExp(`\\s+${operator}\\s+`, 'igy');
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === '(') depth += 1;
    else if (expression[index] === ')') depth -= 1;
    if (depth !== 0) continue;
    pattern.lastIndex = index;
    const match = pattern.exec(expression);
    if (!match) continue;
    values.push(expression.slice(start, index).trim());
    start = pattern.lastIndex;
    index = pattern.lastIndex - 1;
  }
  if (values.length === 0) return [expression];
  values.push(expression.slice(start).trim());
  return values;
}

function balanced(expression) {
  let depth = 0;
  for (const character of expression) {
    if (character === '(') depth += 1;
    if (character === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

for (const [path, value] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith('node_modules/') || value.link || value.version === undefined) continue;
  const license = value.license;
  if (typeof license !== 'string' || !license.trim()) findings.push(`LICENSE_MISSING ${path}`);
  else if (!isAllowedLicense(license)) findings.push(`LICENSE_DENIED ${path} ${license}`);
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
  const example = path.endsWith('.example') || /(?:^|\/)\w+\.example\.[a-z0-9]+$/i.test(path);
  for (const [code, pattern] of signatures) if (pattern.test(source) && !example) findings.push(`${code} ${path}`);
  if (/^[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|PRIVATE_KEY)\s*=\s*[^\s#][^\r\n]{7,}$/m.test(source) && !example && !path.includes('/test') && !path.includes('.test.') && !path.includes('.spec.'))
    findings.push(`PLAINTEXT_SECRET_ASSIGNMENT ${path}`);
}

const supplyChain = parse(readFileSync(join(root, 'infrastructure/security/SupplyChain.yml'), 'utf8'));
for (const gate of ['lock', 'sbom', 'vulnerability', 'license', 'signature', 'provenance', 'extension', 'baseImage', 'remoteScript']) {
  if (supplyChain?.gates?.[gate]?.blocking !== true) findings.push(`SUPPLY_CHAIN_GATE_MISSING ${gate}`);
}
if (supplyChain?.gates?.vulnerability?.maximum?.critical !== 0 || supplyChain?.gates?.vulnerability?.maximum?.high !== 0) findings.push('VULNERABILITY_THRESHOLD_UNSAFE');
if (supplyChain?.gates?.baseImage?.digestRequired !== true || !/@sha256:[0-9a-f]{64}/.test(readFileSync(join(root, 'infrastructure/container/Dockerfile'), 'utf8'))) findings.push('BASE_IMAGE_DIGEST_MISSING');
if (supplyChain?.gates?.extension?.manifestSignature !== 'ed25519' || supplyChain?.gates?.extension?.sandboxContract !== 'required') findings.push('EXTENSION_SUPPLY_CHAIN_POLICY_INVALID');

if (findings.length > 0) {
  console.error(`supply-chain policy failed: ${findings.length}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}
console.log(`supply-chain policy: licenses=${Object.keys(lock.packages ?? {}).length} secret findings=0`);
