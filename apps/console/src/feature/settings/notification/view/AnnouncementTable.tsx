import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { Announcement } from '../model/Announcement';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';

export function AnnouncementTable({ rows, model }: Readonly<{ rows: readonly Announcement[]; model: NotificationViewModel }>) {
  const columns: readonly DataColumn<Announcement>[] = [
    { key: 'title', label: '公告标题', render: (row) => <strong>{row.title}</strong> },
    { key: 'audience', label: '受众', render: (row) => (row.audience.kind === 'all' ? '全部成员' : `${row.audience.members.length} 位成员`) },
    { key: 'state', label: '状态', render: (row) => chineseDomainLabel(row.state) },
    { key: 'start', label: '开始时间', render: (row) => formatDate(row.startsAt) },
    { key: 'end', label: '结束时间', render: (row) => formatDate(row.endsAt) },
    { key: 'version', label: '服务端版本', render: (row) => `第 ${row.version} 版` },
    {
      key: 'action',
      label: '操作',
      render: (row) =>
        model.canManage ? (
          <Button tone="primary" onPress={() => model.actions.editAnnouncement(row)}>
            编辑与发布
          </Button>
        ) : null,
    },
  ];
  return <DataTable caption="公告列表" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
