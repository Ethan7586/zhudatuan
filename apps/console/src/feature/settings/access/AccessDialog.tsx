import { Button, Dialog } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import { createActionRequest } from '../../../shared/security/ActionRequest';
import { accessEnvelope, type AccessChange, type AccessRole } from './AccessCommand';
import type { AccessMembership } from './AccessSchema';
import { permissionText, scopeText } from './PermissionText';

export type AccessIntent = Readonly<{ kind: 'role'; membership: AccessMembership; role: AccessRole }> | Readonly<{ kind: 'override'; membership: AccessMembership }> | Readonly<{ kind: 'scope'; membership: AccessMembership }>;

export function AccessDialog({
  intent,
  permissions,
  scopeKind: activeKind,
  scopeResource,
  makerMembership,
  assurance,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{
  intent: AccessIntent | undefined;
  permissions: readonly string[];
  scopeKind: string;
  scopeResource: string;
  makerMembership: string;
  assurance: number;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (change: AccessChange) => void;
}>) {
  const [name, setName] = useState('');
  const [allows, setAllows] = useState<readonly string[]>([]);
  const [denies, setDenies] = useState<readonly string[]>([]);
  const [permission, setPermission] = useState('');
  const [overrideAction, setOverrideAction] = useState<'set' | 'revoke'>('set');
  const [effect, setEffect] = useState<'allow' | 'deny'>('allow');
  const [scopeKind, setScopeKind] = useState(activeKind);
  const [scope, setScope] = useState(scopeResource);
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [approval, setApproval] = useState('');
  const [proof, setProof] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  useEffect(() => {
    setName(intent?.kind === 'role' ? intent.role.name : '');
    setAllows(intent?.kind === 'role' ? intent.role.allows : []);
    setDenies(intent?.kind === 'role' ? intent.role.denies : []);
    setPermission(intent?.kind === 'override' ? (intent.membership.overrides[0]?.permission ?? permissions[0] ?? '') : '');
    setOverrideAction('set');
    setEffect('allow');
    setScopeKind(activeKind);
    setScope(scopeResource);
    setExpiresAt('');
    setReason('');
    setApproval('');
    setProof('');
  }, [intent, permissions, activeKind, scopeResource]);
  useEffect(() => {
    setApproval('');
    setProof('');
  }, [name, allows, denies, permission, overrideAction, effect, scopeKind, scope, expiresAt, reason]);
  const candidate = useMemo(
    () => (intent ? change(intent, { name, allows, denies, permission, overrideAction, effect, scopeKind, scope, expiresAt, reason, proof }) : undefined),
    [intent, name, allows, denies, permission, overrideAction, effect, scopeKind, scope, expiresAt, reason, proof]
  );
  const requestApproval = async () => {
    if (!candidate) return;
    setApprovalBusy(true);
    try {
      const envelope = accessEnvelope(candidate);
      setApproval(await createActionRequest(envelope.operation, envelope.input, envelope.expectedVersion, makerMembership, scopeResource));
    } finally {
      setApprovalBusy(false);
    }
  };
  const proofReady = /^[A-Za-z0-9_-]{43,128}$/.test(proof);
  const valid =
    candidate !== undefined && (candidate.kind !== 'override' || candidate.reason.trim().length >= 4) && (candidate.kind !== 'role' || candidate.name.trim().length > 0) && (candidate.kind !== 'scope' || candidate.scope.trim().length > 0);
  return (
    <Dialog open={intent !== undefined} title={dialogTitle(intent)} eyebrow="安全复核 · 双人确认 · 版本校验" onClose={onClose} dismissable={!busy}>
      <form
        className="accessform"
        onSubmit={(event) => {
          event.preventDefault();
          if (candidate) onSubmit(candidate);
        }}
      >
        <section className="accesstarget">
          <span>目标成员关系</span>
          <strong>{intent?.membership.id}</strong>
          <span>当前权限版本：第 {intent?.membership.access_version ?? 0} 版</span>
        </section>
        {intent?.kind === 'role' ? <RoleFields name={name} permissions={permissions} allows={allows} denies={denies} onName={setName} onAllows={setAllows} onDenies={setDenies} /> : null}
        {intent?.kind === 'override' ? (
          <>
            <label>
              操作
              <select value={overrideAction} onChange={(event) => setOverrideAction(event.target.value as typeof overrideAction)}>
                <option value="set">设置覆盖权限</option>
                <option value="revoke">撤销覆盖权限</option>
              </select>
            </label>
            <label>
              业务权限
              <select value={permission} onChange={(event) => setPermission(event.target.value)} required>
                <option value="" disabled>
                  请选择要调整的权限
                </option>
                {permissions.map((value) => (
                  <option key={value} value={value}>
                    {permissionText(value)}
                  </option>
                ))}
              </select>
            </label>
            {permission ? (
              <p className="accesshint">
                所选权限：{permissionText(permission)}
                <small>系统标识：{permission}</small>
              </p>
            ) : null}
            {overrideAction === 'set' ? <EffectFields effect={effect} expiresAt={expiresAt} onEffect={setEffect} onExpires={setExpiresAt} /> : null}
            <label>
              审计原因
              <textarea value={reason} minLength={4} maxLength={500} onChange={(event) => setReason(event.target.value)} required />
            </label>
          </>
        ) : null}
        {intent?.kind === 'scope' ? (
          <>
            <label>
              授权范围
              <select value={scopeKind} onChange={(event) => setScopeKind(event.target.value)}>
                {['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand'].map((value) => (
                  <option key={value} value={value}>
                    {scopeText(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              项目或资源标识
              <input value={scope} onChange={(event) => setScope(event.target.value)} required />
            </label>
            <EffectFields effect={effect} expiresAt={expiresAt} onEffect={setEffect} onExpires={setExpiresAt} />
          </>
        ) : null}
        <section className="accessapproval" aria-label="双人复核">
          <p>{assurance >= 3 ? '当前账号已完成高强度二次验证。请生成复核请求码，并交给另一位拥有相同管理权限的管理员确认。' : '请先通过页面右上角完成二次验证，再发起这项高风险操作。'}</p>
          <Button onPress={() => void requestApproval()} isDisabled={approvalBusy || !valid}>
            {approvalBusy ? '正在绑定…' : '生成复核请求码'}
          </Button>
          {approval ? (
            <>
              <label>
                复核请求码
                <textarea value={approval} readOnly />
              </label>
              <Button onPress={() => void navigator.clipboard.writeText(approval)}>复制请求码</Button>
            </>
          ) : null}
          <label>
            一次性复核凭证
            <input value={proof} autoComplete="off" spellCheck={false} onChange={(event) => setProof(event.target.value.trim())} placeholder="粘贴另一位管理员签发的复核凭证" required />
          </label>
        </section>
        {error === undefined ? null : (
          <p className="accesserror" role="alert">
            {error}
          </p>
        )}
        <footer>
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || assurance < 3 || !valid || !proofReady}>
            {busy ? '正在执行…' : '确认执行'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function RoleFields({
  name,
  permissions,
  allows,
  denies,
  onName,
  onAllows,
  onDenies,
}: Readonly<{
  name: string;
  permissions: readonly string[];
  allows: readonly string[];
  denies: readonly string[];
  onName: (value: string) => void;
  onAllows: (value: readonly string[]) => void;
  onDenies: (value: readonly string[]) => void;
}>) {
  return (
    <>
      <label>
        角色名称
        <input value={name} onChange={(event) => onName(event.target.value)} required />
      </label>
      <fieldset className="accessmatrix">
        <legend>角色权限</legend>
        <p>为每项业务权限选择“允许”“拒绝”或“沿用上级”。拒绝规则优先于允许规则。</p>
        {permissions.map((value) => {
          const selected = denies.includes(value) ? 'deny' : allows.includes(value) ? 'allow' : 'inherit';
          return (
            <div className="accessmatrixrow" key={value}>
              <span>
                <strong>{permissionText(value)}</strong>
                <small>{value}</small>
              </span>
              <select
                aria-label={`${permissionText(value)}的授权规则`}
                value={selected}
                onChange={(event) => {
                  const next = event.target.value;
                  onAllows(updateSelection(allows, value, next === 'allow'));
                  onDenies(updateSelection(denies, value, next === 'deny'));
                }}
              >
                <option value="inherit">沿用上级</option>
                <option value="allow">允许</option>
                <option value="deny">拒绝</option>
              </select>
            </div>
          );
        })}
      </fieldset>
    </>
  );
}
function EffectFields({ effect, expiresAt, onEffect, onExpires }: Readonly<{ effect: 'allow' | 'deny'; expiresAt: string; onEffect: (value: 'allow' | 'deny') => void; onExpires: (value: string) => void }>) {
  return (
    <>
      <label>
        效果
        <select value={effect} onChange={(event) => onEffect(event.target.value as typeof effect)}>
          <option value="allow">允许</option>
          <option value="deny">拒绝</option>
        </select>
      </label>
      <label>
        失效时间（可选）
        <input type="datetime-local" value={expiresAt} onChange={(event) => onExpires(event.target.value)} />
      </label>
    </>
  );
}
function updateSelection(values: readonly string[], permission: string, selected: boolean): readonly string[] {
  return selected ? [...new Set([...values, permission])].sort() : values.filter((value) => value !== permission);
}
function change(
  intent: AccessIntent,
  value: Readonly<{
    name: string;
    allows: readonly string[];
    denies: readonly string[];
    permission: string;
    overrideAction: 'set' | 'revoke';
    effect: 'allow' | 'deny';
    scopeKind: string;
    scope: string;
    expiresAt: string;
    reason: string;
    proof: string;
  }>
): AccessChange {
  if (intent.kind === 'role') return { ...intent, name: value.name, allows: value.allows, denies: value.denies, proof: value.proof };
  if (intent.kind === 'override')
    return { ...intent, action: value.overrideAction, permission: value.permission.trim(), effect: value.effect, ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt).toISOString() } : {}), reason: value.reason, proof: value.proof };
  return { ...intent, scopeKind: value.scopeKind, scope: value.scope, effect: value.effect, ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt).toISOString() } : {}), proof: value.proof };
}
function dialogTitle(intent: AccessIntent | undefined): string {
  return intent?.kind === 'role' ? '编辑自定义角色' : intent?.kind === 'scope' ? '配置项目范围' : '编辑成员权限';
}
