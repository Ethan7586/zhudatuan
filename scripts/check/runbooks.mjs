import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const names = [
  'deployment', 'catalogimport', 'inventoryimport', 'memberimport', 'voucherimport', 'orderimport', 'financeimport',
  'voucherissue', 'voucherstatus', 'voucherexpiry', 'reconciliation', 'settlement', 'invoice', 'paymentquery',
  'paymentrefund', 'providerhealth', 'catalogsync', 'pricesync', 'inventorysync', 'statementsync',
  'experiencepublish', 'mallentry', 'supportreassign', 'supportrelay', 'supportscan', 'supportsla', 'notification',
  'auditarchive', 'securityincident', 'sessioncompromise', 'approval', 'joblease', 'outbox', 'deadletter',
];
const sections = ['触发症状、用户影响与严重级', 'Owner 与前置权限', '只读诊断', '止血', '恢复', '数据核对', '回滚边界', '沟通模板', '关闭条件', '复盘链接'];
const read = (name) => readFileSync(join(root, 'docs/operations', `${name}.md`), 'utf8');
for (const name of names) {
  const file = join(root, 'docs/operations', `${name}.md`);
  if (!existsSync(file)) fail(`RUNBOOK_MISSING:${name}`);
  const source = read(name);
  for (const section of sections) if (!new RegExp(`^## ${section}`, 'm').test(source)) fail(`RUNBOOK_SECTION_MISSING:${name}:${section}`);
  for (const topic of ['Trigger', 'Impact', 'Owner', 'Stop loss', 'Diagnosis', 'Recovery', 'Data repair', 'Validation', 'Escalation', 'Audit', 'Postmortem']) {
    if (!new RegExp(topic, 'i').test(source)) fail(`RUNBOOK_TOPIC_MISSING:${name}:${topic}`);
  }
  if (/\b(?:password|secret|token|cookie|authorization)\s*[=:]\s*["'][^<{]/i.test(source)) fail(`RUNBOOK_SECRET_LITERAL:${name}`);
}

const deployment = read('deployment');
requireAll('DEPLOYMENT', deployment, ['Api', 'Jobs', 'Provider', 'Migration', 'auth', 'console', 'storefront', 'miniapp', 'store', 'supplier', 'Canary', 'Retire', '签字', '证据', '1/10/50/100']);
const importCommon = read('import');
for (const name of ['catalogimport', 'inventoryimport', 'memberimport', 'voucherimport', 'orderimport', 'financeimport']) {
  const combined = `${read(name)}\n${importCommon}`;
  requireAll(`IMPORT:${name}`, combined, ['Runtime', 'Checkpoint', '错误文件', '重试', '取消', 'total =', 'Scope', 'Hash']);
}
for (const name of ['orderimport', 'financeimport']) {
  const source = read(name);
  if (!source.includes('只遵循 `import.md`') || source.includes('runtime.imports.confirm')) fail(`DOMAIN_IMPORT_DUPLICATES_RUNTIME:${name}`);
}
requireAll('VOUCHER', ['voucherissue', 'voucherstatus', 'voucherexpiry'].map(read).join('\n'), ['VoucherProduct', 'Pool', 'Credential', 'IssueBatch', 'Hold', 'Refund', 'Secret', '人工接管']);
requireAll('FINANCE', ['reconciliation', 'settlement', 'invoice', 'financeimport'].map(read).join('\n'), ['Statement', '差异', '审批', '修复', '关账', 'Settlement', 'Withdrawal', 'Invoice', 'Journal', '借贷']);
requireAll('PAYMENT', ['paymentquery', 'paymentrefund'].map(read).join('\n'), ['Unknown', '迟到', 'Provider Query', '人工接管', '重复', '金额', '守恒']);
const provider = ['providerhealth', 'catalogsync', 'pricesync', 'inventorysync', 'statementsync'].map(read).join('\n');
requireAll('PROVIDER', provider, ['jdproduct', 'jdfresh', 'tmall', 'supplier', 'cake', 'flower', 'book', 'charge', 'foodvoucher', 'movie', 'meal', '熔断', '限速', '凭据', '回放', '隔离', 'Checkpoint']);
requireAll('EXPERIENCE', ['experiencepublish', 'mallentry'].map(read).join('\n'), ['商城', '团购', '政企', 'CDN', '原子', '域名', '旧版', '恢复', 'Cache Head']);
requireAll('SUPPORT', ['supportreassign', 'supportrelay', 'supportscan', 'supportsla', 'notification'].map(read).join('\n'), ['实时流', '持久历史', '附件', '扫描', 'Receipt', '积压', '降级']);
requireAll('SECURITY', ['auditarchive', 'securityincident', 'sessioncompromise'].map(read).join('\n'), ['证据', 'Secret', 'PII', '会话', '撤销', '通知', '复盘']);
requireAll('APPROVAL', read('approval'), ['Template', '任务', '升级', 'Proof', '过期', '职责分离']);
requireAll('RUNTIME', ['joblease', 'outbox', 'deadletter'].map(read).join('\n'), ['租约', 'Fencing', '积压', '重放', '重复效果', 'Checkpoint']);

console.log(`runbook contract: ${names.length} fixed-format owner runbooks plus one shared import procedure`);

function requireAll(kind, source, values) {
  for (const value of values) if (!source.toLowerCase().includes(value.toLowerCase())) fail(`${kind}_DETAIL_MISSING:${value}`);
}

function fail(code) {
  throw new Error(code);
}
