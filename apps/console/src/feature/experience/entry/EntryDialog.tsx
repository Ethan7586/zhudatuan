import { Button, Dialog } from '@shop/design';
import { Component, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import type { Experience } from '../ExperienceSchema';
import { entryView } from './EntryState';
import './Entry.css';

const QrCode = lazy(() => import('@shop/design/qrcode').then((module) => ({ default: module.QrCode })));

export function EntryDialog({ record, onClose }: Readonly<{ record: Experience | null; onClose: () => void }>) {
  const container = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState('');
  if (record === null) return null;
  const view = entryView(record.entry);
  const close = () => {
    setFeedback('');
    onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(record.entry.url);
      setFeedback('商城链接已复制');
    } catch {
      setFeedback('复制失败，请长按或选择下方链接手动复制');
    }
  };
  const download = async () => {
    const svg = container.current?.querySelector('svg');
    if (!svg) return setFeedback('二维码尚未生成，请稍后重试');
    try {
      const blob = await png(svg, 1024);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${filename(record.name)}-商城码.png`;
      anchor.click();
      URL.revokeObjectURL(href);
      setFeedback('二维码已下载');
    } catch {
      setFeedback('浏览器阻止了下载，请重试');
    }
  };
  const open = () => {
    const target = window.open(record.entry.url, '_blank', 'noopener,noreferrer');
    if (target) target.opener = null;
    else setFeedback('浏览器阻止了新窗口，请复制下方链接打开');
  };
  return (
    <Dialog open title="商城入口" eyebrow={record.name} onClose={close}>
      <section className="commerceentrydialog">
        <p className={`commerceentrystate is-${view.tone}`}>
          <i aria-hidden="true" />
          {view.title}
          {record.publishedSequence === null ? '' : ` · v${record.publishedSequence}`}
        </p>
        {view.qr ? (
          <div className="commerceqrframe" ref={container}>
            <QrBoundary fallback={<p role="alert">二维码生成失败，可复制链接进入商城。</p>}>
              <Suspense
                fallback={
                  <div className="commerceqrskeleton" role="status">
                    正在生成二维码…
                  </div>
                }
              >
                <QrCode value={record.entry.url} size={232} label={`${record.name}商城二维码`} />
              </Suspense>
            </QrBoundary>
          </div>
        ) : (
          <div className={`commerceentryempty is-${view.tone}`} role="status">
            <span aria-hidden="true">{view.tone === 'danger' ? '!' : '码'}</span>
            <p>{view.description}</p>
          </div>
        )}
        <div className="commerceentryaddress">
          <strong>{view.qr ? '手机扫码进入该商城' : '商城规范地址'}</strong>
          <a href={record.entry.url} target="_blank" rel="noreferrer">
            {record.entry.url}
          </a>
        </div>
        {view.actions ? (
          <div className="commerceentryactions">
            <Button onPress={() => void copy()}>复制链接</Button>
            <Button onPress={() => void download()}>下载二维码</Button>
            <Button tone="primary" onPress={open}>
              新窗口打开商城
            </Button>
          </div>
        ) : null}
        <p className="commerceentryhint">{view.description}</p>
        <p className="commerceentryfeedback" aria-live="polite">
          {feedback}
        </p>
      </section>
    </Dialog>
  );
}

class QrBoundary extends Component<{ readonly fallback: ReactNode; readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

async function png(svg: SVGSVGElement, size: number): Promise<Blob> {
  const source = new XMLSerializer().serializeToString(svg);
  const reference = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.decoding = 'sync';
    image.src = reference;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('QRCODE_CANVAS_UNAVAILABLE');
    context.imageSmoothingEnabled = false;
    context.fillStyle = 'white';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('QRCODE_PNG_FAILED'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(reference);
  }
}

function filename(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 80) || '商城'
  );
}
