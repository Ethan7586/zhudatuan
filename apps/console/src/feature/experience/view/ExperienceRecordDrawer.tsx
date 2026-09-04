import { Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { Experience } from '../model/Experience';
import type { ExperienceDetailViewModel } from '../viewmodel/DetailViewModel';
import { applicationStatusLabel, domainLabel, publicationLabel, themeLabel } from './ExperiencePresentation';

export function ExperienceRecordDrawer({ record, model, onClose }: Readonly<{ record: Experience | undefined; model: ExperienceDetailViewModel; onClose: () => void }>) {
  if (record === undefined) return null;
  const detail = model.data;
  return (
    <Dialog open title={record.name} eyebrow="商城应用详情" onClose={onClose}>
      {model.pending ? (
        <p role="status">正在读取装修与发布详情…</p>
      ) : model.failed || !detail ? (
        <section role="alert">
          <p>详情读取失败：{model.error}</p>
          <button type="button" onClick={model.refresh}>
            重试
          </button>
        </section>
      ) : (
        <div className="commercedrawerbody">
          <section className="commercedrawerstatus">
            <strong>{applicationStatusLabel(detail.status)}</strong>
            <span>{domainLabel(detail.domain)}</span>
            <p>列表保持轻量；装修文档和有限历史仅在打开详情时读取。</p>
          </section>
          <dl className="commercefacts">
            <Fact label="应用代码" value={chineseReference('应用', detail.code)} />
            <Fact label="商城归属" value={detail.mallName ?? chineseReference('商城', detail.mallId)} />
            <Fact label="品牌" value={detail.brandName ?? '品牌资料待同步'} />
            <Fact label="装修主题" value={themeLabel(detail.theme)} />
            <Fact label="公开入口" value={detail.entry.url} />
            <Fact label="域名地址" value={detail.domain.address ?? '域名资料待同步'} />
            <Fact label="域名健康" value={domainLabel(detail.domain)} />
            <Fact label="当前草稿" value={detail.headSequence === null ? '尚未建立' : `第 ${detail.headSequence} 版`} />
            <Fact label="发布版本" value={publicationLabel(detail)} />
            <Fact label="历史摘要" value={`${detail.history.length} 条（最多 20 条）`} />
            <Fact label="更新时间" value={formatDate(detail.updatedAt)} />
          </dl>
          <section className="commercewriteboundary" role="note">
            <strong>安全边界</strong>
            <p>商城入口只读取当前有效发布制品，草稿不会通过二维码泄露。</p>
          </section>
        </div>
      )}
    </Dialog>
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
