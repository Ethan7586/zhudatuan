import { Button } from '@shop/design';
import type { OperationOutputFor } from '@shop/contract';
import { useEffect, useState } from 'react';
import type { AccountChange } from '../model/SupportConfig';

type Account = OperationOutputFor<'support.accounts.read'>['items'][number];
type Body = AccountChange;

export function AccountSettings({
  rows,
  busy,
  disabled,
  onSave,
}: Readonly<{
  rows: readonly Account[];
  busy: boolean;
  disabled: boolean;
  onSave: (id: string, version: number, body: Body) => void;
}>) {
  const [id, setId] = useState(rows[0]?.id ?? nextId());
  const row = rows.find((item) => item.id === id);
  const [provider, setProvider] = useState<Body['provider']>(row?.provider ?? 'inapp');
  const [displayName, setDisplayName] = useState(row?.display_name ?? '');
  const [secretRef, setSecretRef] = useState('');
  const [state, setState] = useState<Body['state']>(row?.state ?? 'active');
  const edit = (value: string) => {
    const found = rows.find((item) => item.id === value);
    setId(value);
    if (!found) return;
    setProvider(found.provider);
    setDisplayName(found.display_name);
    setSecretRef('');
    setState(found.state);
  };
  const create = () => {
    setId(nextId());
    setProvider('inapp');
    setDisplayName('');
    setSecretRef('');
    setState('active');
  };
  useEffect(() => {
    if (!row && rows[0] && displayName === '' && secretRef === '') edit(rows[0].id);
  }, [rows]);
  const secretRequired = provider !== 'inapp' && !row;
  return (
    <section className="supportsettingsection">
      <header>
        <div>
          <h2>渠道账号</h2>
          <p>密钥只保存到安全密钥库；保存前会先验证连接，列表永不读取或返回真实密钥。</p>
        </div>
        <Button onPress={create}>新增账号</Button>
      </header>
      <label>
        选择账号
        <select value={id} onChange={(event) => edit(event.target.value)}>
          {row ? null : <option value={id}>新账号</option>}
          {rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.display_name} · 第 {item.version} 版
            </option>
          ))}
        </select>
      </label>
      {row ? (
        <p className={`supportvalidation supportvalidation${row.validation_state}`} role="status">
          {validationLabel(row)}
          {row.validated_at ? ` · ${new Date(row.validated_at).toLocaleString('zh-CN', { hour12: false })}` : ''}
        </p>
      ) : null}
      <div className="supportsettingsgrid">
        <label>
          渠道
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as Body['provider']);
              setSecretRef('');
            }}
          >
            <option value="inapp">站内</option>
            <option value="wechat">微信</option>
            <option value="email">邮件</option>
            <option value="sms">短信</option>
          </select>
        </label>
        <label>
          账号显示名称
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} />
        </label>
        {provider === 'inapp' ? null : (
          <label>
            密钥引用
            <input type="password" value={secretRef} onChange={(event) => setSecretRef(event.target.value)} placeholder={row ? '留空则复用并重新验证现有密钥' : '填写安全密钥库中的引用地址'} autoComplete="off" />
          </label>
        )}
        <label>
          状态
          <select value={state} onChange={(event) => setState(event.target.value as Body['state'])}>
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </label>
      </div>
      <Button
        tone="primary"
        isDisabled={busy || disabled || displayName.trim() === '' || (secretRequired && secretRef.trim() === '')}
        onPress={() => onSave(id, row?.version ?? 0, { provider, displayName: displayName.trim(), ...(provider !== 'inapp' && secretRef ? { secretRef } : {}), state })}
      >
        {busy ? '验证并保存中…' : provider === 'inapp' ? '保存账号' : '验证连接并保存'}
      </Button>
    </section>
  );
}

function validationLabel(account: Account): string {
  if (account.validation_state === 'verified') return '最近连接验证成功';
  if (account.validation_state === 'notrequired') return '站内渠道无需外部连接';
  return '需要重新验证连接后才能启用';
}

function nextId(): string {
  return `account:${crypto.randomUUID()}`;
}
