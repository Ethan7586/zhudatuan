import { Button } from '@shop/design';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';

export function DialogFooter({ model }: Readonly<{ model: NotificationViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  const blocked = model.validation !== undefined || model.assurance < 3 || !editor.confirmed || !/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof);
  return (
    <>
      {model.saving.error ? (
        <p className="notificationerror" role="alert">
          {model.saving.error}
        </p>
      ) : null}
      {model.validation ? <p className="notificationvalidation">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.reviewing ? model.actions.revise : model.actions.close} isDisabled={model.saving.busy}>
          {model.reviewing ? '返回修改' : '取消'}
        </Button>
        {model.reviewing ? (
          <Button type="submit" tone="primary" isDisabled={model.saving.busy || blocked}>
            {model.saving.busy ? '正在提交…' : '审批并提交'}
          </Button>
        ) : (
          <Button tone="primary" onPress={model.actions.preview} isDisabled={model.validation !== undefined}>
            校验并预览
          </Button>
        )}
      </footer>
    </>
  );
}
