import { Button } from '@shop/design';

export function DialogFooter({ busy, disabled, label, onClose }: Readonly<{ busy: boolean; disabled: boolean; label: string; onClose: () => void }>) {
  return (
    <footer>
      <Button onPress={onClose} isDisabled={busy}>
        取消
      </Button>
      <Button type="submit" tone="primary" isDisabled={busy || disabled}>
        {busy ? '正在提交…' : label}
      </Button>
    </footer>
  );
}
