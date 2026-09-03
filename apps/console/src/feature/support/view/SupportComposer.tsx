import { Button } from '@shop/design';
import type { KeyboardEvent } from 'react';
import type { MessageDraft, UploadedAttachment } from '../model/Message';

export function SupportComposer({
  draft,
  unavailable,
  sending,
  failed,
  attachments,
  onDraft,
  onSend,
  onRetry,
  onFile,
}: Readonly<{
  draft: string;
  unavailable: string;
  sending: boolean;
  failed?: MessageDraft;
  attachments: readonly UploadedAttachment[];
  onDraft: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onFile: (file: File) => void;
}>) {
  const disabled = unavailable !== '' || sending;
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend();
  };
  return (
    <form
      className="supportcomposer"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="supportcomposerbar">
        <label className="supportattach">
          <span aria-hidden="true">＋</span>
          <span className="sr-only">添加附件</span>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf,text/plain"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <span>按回车键发送 · 按住上档键并回车换行</span>
        <small>{draft.length}/4000</small>
      </div>
      {attachments.length ? (
        <ul className="supportuploads">
          {attachments.map((item) => (
            <li key={item.id} data-state={item.state}>
              <span>{item.name}</span>
              <em>{uploadLabel(item.state)}</em>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={keyDown} maxLength={4000} rows={3} disabled={disabled} placeholder={unavailable || '输入回复内容…'} aria-label="回复内容" />
      <div className="supportcomposeractions">
        <span role="status">{sending ? '正在安全发送…' : unavailable}</span>
        {failed ? (
          <Button tone="danger" onPress={onRetry}>
            重试上次发送
          </Button>
        ) : null}
        <Button type="submit" tone="primary" isDisabled={disabled || draft.trim() === '' || attachments.some((item) => item.state !== 'clean')}>
          {sending ? '发送中…' : '发送回复'}
        </Button>
      </div>
    </form>
  );
}

function uploadLabel(state: UploadedAttachment['state']): string {
  return { uploading: '上传中', pending: '安全扫描中', clean: '可发送', rejected: '已拒绝', failed: '上传失败' }[state];
}
