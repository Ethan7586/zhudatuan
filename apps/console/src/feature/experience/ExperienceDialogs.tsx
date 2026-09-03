import { Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { formatDate } from '../../shared/ui/Format';
import { applicationDetailKey, readExperienceDetail } from './ExperienceQuery';
import { applicationStatusLabel, entryLabel, publicationLabel } from './ExperiencePresentation';
import type { Experience } from './ExperienceSchema';

export function ExperienceRecordDrawer({ record, context, onClose }: Readonly<{ record: Experience | undefined; context: ConsoleContext; onClose: () => void }>) {
  const query = useQuery({
    queryKey: applicationDetailKey(context, record?.id ?? 'closed'),
    queryFn: ({ signal }) => readExperienceDetail(context, record!.id, signal),
    enabled: record !== undefined,
    staleTime: 30_000,
  });
  if (record === undefined) return null;
  const detail = query.data;
  return (
    <Dialog open title={record.name} eyebrow="商城应用详情" onClose={onClose}>
      {query.isPending ? (
        <p role="status">正在读取装修与发布详情…</p>
      ) : query.isError || !detail ? (
        <p role="alert">详情读取失败，请关闭后重试。</p>
      ) : (
        <div className="commercedrawerbody">
          <section className="commercedrawerstatus">
            <strong>{applicationStatusLabel(detail.status)}</strong>
            <span>{entryLabel(detail.entry.state)}</span>
            <p>列表保持轻量；装修文档和有限历史仅在打开详情时读取。</p>
          </section>
          <dl className="commercefacts">
            <Fact label="应用代码" value={chineseReference('应用', detail.code)} />
            <Fact label="商城归属" value={chineseReference('商城', detail.mallId)} />
            <Fact label="公开入口" value={detail.entry.url} />
            <Fact label="入口状态" value={entryLabel(detail.entry.state)} />
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
