import { Button, Dialog } from '@shop/design';
import { useState, type ChangeEvent } from 'react';

export interface LocalImportDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly resourceLabel: string;
  readonly onClose: () => void;
}

export function LocalImportDialog({ open, title, resourceLabel, onClose }: LocalImportDialogProps) {
  const [file, setFile] = useState<File>();
  const [unavailable, setUnavailable] = useState(false);

  const close = () => {
    setFile(undefined);
    setUnavailable(false);
    onClose();
  };
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0]);
    setUnavailable(false);
  };

  return (
    <Dialog open={open} title={title} eyebrow="LOCAL IMPORT PREVIEW" onClose={close}>
      <p>选择本地 CSV 文件预览{resourceLabel}导入交互；本期不会上传文件。</p>
      <label>
        选择 CSV 文件
        <input
          type="file"
          accept=".csv,text/csv"
          onClick={(event) => {
            event.currentTarget.value = '';
          }}
          onChange={selectFile}
        />
      </label>
      {file === undefined ? null : (
        <dl aria-label="已选择文件">
          <div>
            <dt>文件名</dt>
            <dd>{file.name}</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{file.size} 字节</dd>
          </div>
          <div>
            <dt>最后修改时间</dt>
            <dd>
              <time dateTime={new Date(file.lastModified).toISOString()}>{formatModifiedTime(file.lastModified)}</time>
            </dd>
          </div>
        </dl>
      )}
      {unavailable ? (
        <div role="status">
          <strong>导入服务尚未上线</strong>
          <p>文件未上传，生产数据没有发生变化。</p>
          <code>IMPORT_SERVICE_UNAVAILABLE</code>
        </div>
      ) : null}
      <div>
        <Button onPress={close}>取消</Button>
        <Button tone="primary" isDisabled={file === undefined} onPress={() => setUnavailable(true)}>
          开始导入
        </Button>
      </div>
    </Dialog>
  );
}

function formatModifiedTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
