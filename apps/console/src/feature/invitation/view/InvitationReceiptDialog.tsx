import { Button, Dialog } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import type { InvitationViewModel } from '../viewmodel/InvitationViewModel';
import { invitationAuthUrl } from '../../../shared/url/AuthUrl';
import { invitationKind, invitationTarget, invitationTime } from '../viewmodel/InvitationText';

export function InvitationReceiptDialog({ receipt, organization, onDiscard }: Readonly<{ receipt?: InvitationViewModel['receipt']; organization: string; onDiscard: () => void }>) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setCopyState('idle');
    setConfirming(false);
  }, [receipt]);
  const code = receipt?.code ?? '';
  const displayCode = useMemo(
    () =>
      code
        .replaceAll(/\s/g, '')
        .match(/.{1,4}/g)
        ?.join(' ') ?? code,
    [code]
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };
  return (
    <Dialog open={receipt !== undefined} title={confirming ? '确认关闭回执' : '邀请码已创建'} eyebrow="仅本次可见" onClose={() => setConfirming(true)} dismissable={!confirming}>
      {receipt === undefined ? null : confirming ? (
        <div className="invitationreceiptconfirm">
          <p role="alert">关闭后无法再次查看或恢复此邀请码。请确认已经安全传递给员工。</p>
          <div className="invitationactions">
            <Button onPress={() => setConfirming(false)}>继续查看</Button>
            <Button tone="danger" onPress={onDiscard}>
              关闭并清除
            </Button>
          </div>
        </div>
      ) : (
        <div className="invitationreceipt">
          <div className="invitationsecure">
            <strong>请立即安全保存</strong>
            <span>邀请码不会进入列表、网页地址、缓存或浏览器存储。</span>
          </div>
          <code aria-label="一次性邀请码">{displayCode}</code>
          <div className="invitationhandoff">
            <strong>{receipt.kind === 'signin' ? '交给指定成员完成身份确认' : '交给接收人完成邀请注册'}</strong>
            <ol>
              <li>复制并通过可信渠道发送一次性邀请码</li>
              <li>让接收人打开统一邀请页并输入邀请码</li>
              <li>{receipt.kind === 'signin' ? '本人验证通过后按现有权限进入系统' : '本人验证并设置密码后完成注册'}</li>
            </ol>
          </div>
          <div className="invitationreceiptcommands">
            <Button tone="primary" onPress={() => void copy()}>
              {copyState === 'copied' ? '已复制邀请码' : '复制邀请码'}
            </Button>
            <a className="shopbutton shopbuttondefault" href={invitationAuthUrl(receipt.target)} target="_blank" rel="noreferrer">
              打开统一邀请页
            </a>
          </div>
          {copyState === 'failed' ? (
            <p className="invitationerror" role="alert">
              复制失败，请选中邀请码手动复制。
            </p>
          ) : null}
          <dl className="invitationreceiptmeta">
            <div>
              <dt>邀请类型</dt>
              <dd>{invitationKind(receipt.kind)}</dd>
            </div>
            <div>
              <dt>使用位置</dt>
              <dd>{invitationTarget(receipt.target)}</dd>
            </div>
            <div>
              <dt>组织</dt>
              <dd>{organization}</dd>
            </div>
            {receipt.employee ? (
              <div>
                <dt>员工</dt>
                <dd>
                  {receipt.employee.displayName}
                  {receipt.employee.employeeNo ? ` · ${receipt.employee.employeeNo}` : ''}
                </dd>
              </div>
            ) : null}
            {receipt.recipientMasked ? (
              <div>
                <dt>接收人</dt>
                <dd>{receipt.recipientMasked}</dd>
              </div>
            ) : null}
            <div>
              <dt>到期时间</dt>
              <dd>{invitationTime(receipt.expiresAt)}</dd>
            </div>
            <div>
              <dt>可用次数</dt>
              <dd>{receipt.maxUses}</dd>
            </div>
          </dl>
          <div className="invitationactions">
            <Button onPress={() => setConfirming(true)}>完成并关闭</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
