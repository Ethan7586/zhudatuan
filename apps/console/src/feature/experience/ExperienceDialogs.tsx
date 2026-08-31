import { useEffect, useRef, type RefObject } from 'react';
import { formatDate } from '../../shared/ui/Format';
import { applicationStatusLabel, applicationStatusTone, publicationLabel, validationLabel, validationTone } from './ExperiencePresentation';
import type { Experience } from './ExperienceSchema';

export function ExperienceRecordDrawer({ record, onClose }: Readonly<{ record: Experience | undefined; onClose: () => void }>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(record !== undefined, onClose, closeRef);
  if (record === undefined) return null;
  return (
    <div className="commerceoverlay is-drawer">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭商城应用摘要" />
      <aside className="commercedrawer" role="dialog" aria-modal="true" aria-labelledby="commercedrawertitle">
        <header>
          <div>
            <p>COMMERCE APPLICATION · 只读摘要</p>
            <h2 id="commercedrawertitle">{record.name}</h2>
            <code>{record.id}</code>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭商城应用摘要">
            ×
          </button>
        </header>
        <div className="commercedrawerbody">
          <section className="commercedrawerstatus">
            <span className={`commercestate is-${applicationStatusTone(record.status)}`}>
              <i aria-hidden="true" />
              {applicationStatusLabel(record.status)}
            </span>
            <span className={`commercestate is-${validationTone(record.head_validation_state)}`}>
              <i aria-hidden="true" />
              {validationLabel(record.head_validation_state)}
            </span>
            <p>这里只展示 experience.applications.read 已返回的权威字段，不推断页面配置或审核结论。</p>
          </section>
          <dl className="commercefacts">
            <Fact label="应用代码" value={record.code} />
            <Fact label="公开路径" value={`/${record.public_slug}`} />
            <Fact label="商城绑定" value={record.mall_id ?? '尚未绑定'} />
            <Fact label="商品池绑定" value={record.pool_id ?? '尚未绑定'} />
            <Fact label="当前草稿" value={record.head_sequence == null ? '尚未建立' : `v${record.head_sequence}`} />
            <Fact label="发布版本" value={publicationLabel(record)} />
            <Fact label="绑定域名" value={record.domain ?? '尚未绑定'} />
            <Fact label="更新时间" value={formatDate(record.updated_at)} />
          </dl>
          <section className="commercewriteboundary" role="note">
            <strong>安全边界</strong>
            <p>编辑、校验、发布与恢复必须使用独立写 Operation、expectedVersion 和操作证明；当前抽屉只读。</p>
          </section>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function useDialogKeyboard(open: boolean, onClose: () => void, focusRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previous?.focus();
    };
  }, [focusRef, onClose, open]);
}
