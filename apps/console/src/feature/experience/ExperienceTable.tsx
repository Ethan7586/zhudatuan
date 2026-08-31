import { useMemo } from 'react';
import type { DataColumn } from '../../shared/ui/DataTable';
import { DataTable } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { applicationStatusLabel, applicationStatusTone, publicationLabel, validationLabel, validationTone } from './ExperiencePresentation';
import type { Experience } from './ExperienceSchema';
import type { CommerceWorkspaceMode } from './ExperienceScope';

export function ExperienceTable({
  rows,
  mode,
  onOpen,
  onCopy,
  onManage,
  onDesign,
}: Readonly<{
  rows: readonly Experience[];
  mode: CommerceWorkspaceMode;
  onOpen: (record: Experience) => void;
  onCopy: (record: Experience) => void;
  onManage: (record: Experience) => void;
  onDesign: (record: Experience) => void;
}>) {
  const columns = useMemo(() => applicationColumns(mode, onOpen, onCopy, onManage, onDesign), [mode, onCopy, onDesign, onManage, onOpen]);
  return <DataTable caption={tableCaption(mode)} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function applicationColumns(
  mode: CommerceWorkspaceMode,
  onOpen: (record: Experience) => void,
  onCopy: (record: Experience) => void,
  onManage: (record: Experience) => void,
  onDesign: (record: Experience) => void
): readonly DataColumn<Experience>[] {
  return Object.freeze([
    {
      key: 'identity',
      label: mode === 'design' ? '当前店铺应用' : '商城 / 应用',
      render: (row) => (
        <div className="commerceidentity">
          <span className="commerceappmark" aria-hidden="true">
            店
          </span>
          <span>
            <button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}摘要`}>
              {row.name}
            </button>
            <code>{row.code}</code>
          </span>
        </div>
      ),
    },
    {
      key: 'binding',
      label: '商城 / 商品池',
      render: (row) => (
        <div className="commercebinding">
          <span>{row.mall_id ?? '未绑定商城'}</span>
          <code>{row.pool_id ?? '未绑定商品池'}</code>
        </div>
      ),
    },
    {
      key: 'draft',
      label: '装修草稿',
      render: (row) => (
        <div className="commerceversion">
          <strong>{row.head_sequence === null || row.head_sequence === undefined ? '—' : `v${row.head_sequence}`}</strong>
          <span className={`commercestate is-${validationTone(row.head_validation_state)}`}>
            <i aria-hidden="true" />
            {validationLabel(row.head_validation_state)}
          </span>
        </div>
      ),
    },
    {
      key: 'publication',
      label: '发布 / 域名',
      render: (row) => (
        <div className="commercepublication">
          <strong>{publicationLabel(row)}</strong>
          <span>{row.domain ?? '域名未绑定'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: '经营状态',
      render: (row) => (
        <span className={`commercestate is-${applicationStatusTone(row.status)}`}>
          <i aria-hidden="true" />
          {applicationStatusLabel(row.status)}
        </span>
      ),
    },
    { key: 'updated', label: '更新时间', render: (row) => <time>{formatDate(row.updated_at)}</time> },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <span className="commerceactions">
          <button className="commercerowaction" type="button" onClick={() => onOpen(row)}>
            查看
          </button>
          <button className="commercerowaction" type="button" onClick={() => onManage(row)}>
            管理
          </button>
          <button className="commercerowaction" type="button" onClick={() => onCopy(row)}>
            复制
          </button>
          <button className="commercerowaction" type="button" onClick={() => onDesign(row)}>
            装修
          </button>
        </span>
      ),
    },
  ]);
}

function tableCaption(mode: CommerceWorkspaceMode): string {
  if (mode === 'governance') return '应用治理列表';
  if (mode === 'design') return '店铺装修应用';
  return '集团商城列表';
}
