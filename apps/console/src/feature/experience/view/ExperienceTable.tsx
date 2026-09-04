import { useMemo } from 'react';
import { chineseReference } from '@shop/presentation';
import { DataTable, type DataColumn } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import { applicationStatusLabel, applicationStatusTone, domainLabel, domainTone, publicationLabel, themeLabel } from './ExperiencePresentation';
import type { Experience } from '../model/Experience';
import type { CommerceWorkspaceMode } from '../model/ExperienceScope';

interface ExperienceTableProps {
  readonly rows: readonly Experience[];
  readonly mode: CommerceWorkspaceMode;
  readonly permissions: Readonly<{ copy: boolean; update: boolean; publish: boolean }>;
  readonly onOpen: (record: Experience) => void;
  readonly onEntry: (record: Experience, trigger: string) => void;
  readonly onCopy: (record: Experience) => void;
  readonly onManage: (record: Experience) => void;
  readonly onDesign: (record: Experience) => void;
}

export function ExperienceTable({ rows, mode, permissions, onOpen, onEntry, onCopy, onManage, onDesign }: ExperienceTableProps) {
  const columns = useMemo(() => applicationColumns(permissions, onOpen, onEntry, onCopy, onManage, onDesign), [onCopy, onDesign, onEntry, onManage, onOpen, permissions]);
  return <DataTable caption={mode === 'design' ? '店铺装修应用' : mode === 'governance' ? '应用治理列表' : '集团商城列表'} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function applicationColumns(
  permissions: ExperienceTableProps['permissions'],
  onOpen: (row: Experience) => void,
  onEntry: (row: Experience, trigger: string) => void,
  onCopy: (row: Experience) => void,
  onManage: (row: Experience) => void,
  onDesign: (row: Experience) => void
): readonly DataColumn<Experience>[] {
  return Object.freeze([
    {
      key: 'identity',
      label: '商城 / 应用',
      render: (row) => (
        <div className="commerceidentity">
          <span className="commerceappmark" aria-hidden="true">
            店
          </span>
          <span>
            <button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}详情`}>
              {row.name}
            </button>
            <code>{chineseReference('应用', row.code)}</code>
          </span>
        </div>
      ),
    },
    {
      key: 'theme',
      label: '主题 / 商城',
      render: (row) => (
        <div className="commercebinding">
          <strong>{themeLabel(row.theme)}</strong>
          <span>{row.mallName ?? chineseReference('商城', row.mallId)}</span>
        </div>
      ),
    },
    {
      key: 'version',
      label: '装修版本',
      render: (row) => (
        <div className="commerceversion">
          <strong>{row.headSequence === null ? '无草稿' : `草稿第 ${row.headSequence} 版`}</strong>
          <span>{publicationLabel(row)}</span>
        </div>
      ),
    },
    {
      key: 'publication',
      label: '发布 / 域名健康',
      render: (row) => (
        <div className="commercepublication">
          <strong>{publicationLabel(row)}</strong>
          <span className={`commercestate is-${domainTone(row.domain)}`}>
            <i aria-hidden="true" />
            {domainLabel(row.domain)}
          </span>
        </div>
      ),
    },
    {
      key: 'operation',
      label: '经营状态',
      render: (row) => (
        <span className={`commercestate is-${applicationStatusTone(row.status)}`}>
          <i aria-hidden="true" />
          {applicationStatusLabel(row.status)}
        </span>
      ),
    },
    { key: 'updated', label: '更新时间', render: (row) => <time>{formatDate(row.updatedAt)}</time> },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <span className="commerceactions">
          <button className="commercerowaction" type="button" onClick={() => onOpen(row)}>
            查看
          </button>
          <button data-entry-trigger={`${row.id}:action`} className="commercerowaction is-entry" type="button" onClick={() => onEntry(row, `${row.id}:action`)}>
            商城码
          </button>
          <span className="commerceactionwide">
            <button className="commercerowaction" type="button" onClick={() => onManage(row)} disabled={!permissions.update}>
              管理
            </button>
            <button className="commercerowaction" type="button" onClick={() => onCopy(row)} disabled={!permissions.copy}>
              复制
            </button>
            <button className="commercerowaction" type="button" onClick={() => onDesign(row)} disabled={!permissions.publish}>
              装修
            </button>
          </span>
          <details className="commerceactionmore">
            <summary>更多</summary>
            <button type="button" onClick={() => onManage(row)} disabled={!permissions.update}>
              管理
            </button>
            <button type="button" onClick={() => onCopy(row)} disabled={!permissions.copy}>
              复制
            </button>
            <button type="button" onClick={() => onDesign(row)} disabled={!permissions.publish}>
              装修
            </button>
          </details>
        </span>
      ),
    },
  ]);
}
