import { Button, Dialog } from '@shop/design';
import { useEffect, useState } from 'react';

export function InvitationCodeDialog({ code, onClose }: Readonly<{ code: string | undefined; onClose: () => void }>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [code]);
  const copy = async () => {
    if (code === undefined) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };
  return (
    <Dialog open={code !== undefined} title="邀请码已签发" eyebrow="仅本次可见" onClose={onClose}>
      <div className="invitationcode">
        <p>关闭后邀请码将永久丢弃，刷新页面无法恢复。</p>
        <code aria-label="一次性邀请码">{code}</code>
        <div className="invitationactions">
          <Button tone="primary" onPress={() => void copy()}>
            {copied ? '已复制' : '复制邀请码'}
          </Button>
          <Button onPress={onClose}>关闭并丢弃</Button>
        </div>
      </div>
    </Dialog>
  );
}
