import { Paperclip, Send } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { PendingAttachment } from '../model/Attachment';

export function SupportComposer({
  value,
  unavailable,
  sending,
  failed,
  attachments,
  onChange,
  onSend,
  onRetry,
  onFile,
}: Readonly<{
  value: string;
  unavailable: string;
  sending: boolean;
  failed: boolean;
  attachments: readonly PendingAttachment[];
  onChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onFile: (file: File) => void;
}>) {
  const disabled = sending || unavailable !== '';
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend();
  };
  return (
    <form
      className="storesupportcomposer"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      {attachments.length ? (
        <ul className="storesupportuploads">
          {attachments.map((item) => (
            <li key={item.id} data-state={item.state}>
              <span>{item.name}</span>
              <em>{attachmentLabel(item.state)}</em>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="storesupportcomposebar">
        <label aria-label="上传附件">
          <Paperclip size={18} />
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
        <textarea
          aria-label="消息内容"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={keyDown}
          rows={2}
          maxLength={4000}
          disabled={disabled}
          placeholder={unavailable || '输入消息，按回车键发送，按住上档键并回车换行'}
        />
        <button type="submit" disabled={disabled || !value.trim() || attachments.some((item) => item.state !== 'clean')}>
          <Send size={16} />
          {sending ? '发送中…' : '发送'}
        </button>
      </div>
      <div className="storesupportcomposernote">
        <span className={unavailable ? 'danger' : ''}>{unavailable || '请勿发送密码、完整卡密等敏感信息'}</span>
        <span>{value.length}/4000</span>
        {failed ? (
          <button type="button" onClick={onRetry}>
            原样重试上次发送
          </button>
        ) : null}
      </div>
    </form>
  );
}

function attachmentLabel(state: PendingAttachment['state']): string {
  return { uploading: '上传中', pending: '安全扫描中', clean: '可发送', rejected: '已拒绝', failed: '上传失败' }[state];
}
