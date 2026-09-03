import { Button } from '@shop/design';

export function ChannelDialogFooter({ busy, blocked, needsStepup, onClose }: Readonly<{ busy: boolean; blocked: boolean; needsStepup: boolean; onClose: () => void }>) {
  return <footer className="channeldialogfooter"><Button type="button" onPress={onClose} isDisabled={busy}>取消</Button><Button type="submit" tone="primary" isDisabled={busy || (!needsStepup && blocked)}>{busy ? '正在提交…' : needsStepup ? '安全验证后继续' : '确认执行'}</Button></footer>;
}
