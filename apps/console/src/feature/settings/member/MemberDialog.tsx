import { Button, Dialog } from '@shop/design';
import { useEffect, useState } from 'react';
import type { MemberChange } from './MemberCommand';
import type { Member } from './MemberSchema';

export function MemberDialog({
  member,
  assurance,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{
  member: Member | undefined;
  assurance: number;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (change: MemberChange) => void;
}>) {
  const [kind, setKind] = useState<'profile' | 'status'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended' | 'left'>('active');
  const [reason, setReason] = useState('');
  useEffect(() => {
    setKind('profile');
    setDisplayName(member?.display_name ?? '');
    setStatus(memberStatus(member?.membership_status));
    setReason('');
  }, [member]);
  const changed = member !== undefined && (kind === 'profile' ? displayName.trim() !== member.display_name : status !== memberStatus(member.membership_status));
  return (
    <Dialog open={member !== undefined} title="编辑成员" eyebrow="成员资料 · 安全验证 · 版本校验" onClose={onClose} dismissable={!busy}>
      <form
        className="memberform"
        onSubmit={(event) => {
          event.preventDefault();
          if (!member) return;
          onSubmit(kind === 'profile' ? { kind, member, displayName, reason } : { kind, member, status, reason });
        }}
      >
        <section className="membertarget" aria-label="当前成员">
          <strong>{member?.display_name}</strong>
          <span>{member?.employee_no ? `员工号 ${member.employee_no}` : '未设置员工号'}</span>
          <small>当前权限版本：第 {member?.access_version ?? 0} 版</small>
        </section>
        <fieldset>
          <legend>变更类型</legend>
          <label>
            <input type="radio" name="memberchange" checked={kind === 'profile'} onChange={() => setKind('profile')} />
            成员资料
          </label>
          <label>
            <input type="radio" name="memberchange" checked={kind === 'status'} onChange={() => setKind('status')} />
            成员状态
          </label>
        </fieldset>
        {kind === 'profile' ? (
          <label>
            显示名称
            <input value={displayName} minLength={1} maxLength={128} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
        ) : (
          <label>
            成员状态
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="active">正常</option>
              <option value="suspended">暂停</option>
              <option value="left">已离开</option>
            </select>
          </label>
        )}
        <label>
          审计原因
          <textarea value={reason} minLength={4} maxLength={1000} onChange={(event) => setReason(event.target.value)} required />
        </label>
        <p className="membersecurity">{assurance >= 2 ? '当前会话满足验证等级；提交时将校验目标版本并在事务提交后重新读取。' : '请先完成二次验证后再提交成员变更。'}</p>
        {error === undefined ? null : (
          <p className="membererror" role="alert">
            {error}
          </p>
        )}
        <footer>
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || assurance < 2 || !changed || reason.trim().length < 4}>
            {busy ? '正在保存…' : '保存变更'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function memberStatus(value: string | undefined): 'active' | 'suspended' | 'left' {
  return value === 'suspended' || value === 'left' ? value : 'active';
}
