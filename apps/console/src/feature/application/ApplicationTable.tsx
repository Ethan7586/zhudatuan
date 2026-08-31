import { useMemo } from 'react';
import type { DataColumn } from '../../shared/ui/DataTable';
import { DataTable } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
<<<<<<< HEAD
<<<<<<< HEAD
import { applicationStatusLabel, applicationStatusTone, publicationLabel, validationLabel, validationTone } from './ApplicationPresentation';
import type { Application } from './ApplicationSchema';
import type { CommerceWorkspaceMode } from './ApplicationScope';

export function ApplicationTable({
  rows,
  mode,
  canEdit,
  canCopy,
  onOpen,
  onEdit,
  onCopy,
  onDisable,
}: Readonly<{
  rows: readonly Application[];
  mode: CommerceWorkspaceMode;
  canEdit: boolean;
  canCopy: boolean;
  onOpen: (record: Application) => void;
  onEdit: (record: Application) => void;
  onCopy: (record: Application) => void;
  onDisable: (record: Application) => void;
}>) {
  const columns = useMemo(() => applicationColumns(mode, { canEdit, canCopy, onOpen, onEdit, onCopy, onDisable }), [canCopy, canEdit, mode, onCopy, onDisable, onEdit, onOpen]);
  return <DataTable caption={tableCaption(mode)} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

interface ApplicationActions {
  readonly canEdit: boolean;
  readonly canCopy: boolean;
  readonly onOpen: (record: Application) => void;
  readonly onEdit: (record: Application) => void;
  readonly onCopy: (record: Application) => void;
  readonly onDisable: (record: Application) => void;
}

function applicationColumns(mode: CommerceWorkspaceMode, actions: ApplicationActions): readonly DataColumn<Application>[] {
=======
import {
  applicationStatusLabel,
  applicationStatusTone,
  publicationLabel,
  validationLabel,
  validationTone,
} from './ApplicationPresentation';
=======
import { applicationStatusLabel, applicationStatusTone, publicationLabel, validationLabel, validationTone } from './ApplicationPresentation';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import type { Application } from './ApplicationSchema';
import type { CommerceWorkspaceMode } from './ApplicationScope';

export function ApplicationTable({
  rows,
  mode,
  canEdit,
  canCopy,
  onOpen,
  onEdit,
  onCopy,
  onDisable,
}: Readonly<{
  rows: readonly Application[];
  mode: CommerceWorkspaceMode;
  canEdit: boolean;
  canCopy: boolean;
  onOpen: (record: Application) => void;
  onEdit: (record: Application) => void;
  onCopy: (record: Application) => void;
  onDisable: (record: Application) => void;
}>) {
  const columns = useMemo(() => applicationColumns(mode, { canEdit, canCopy, onOpen, onEdit, onCopy, onDisable }), [canCopy, canEdit, mode, onCopy, onDisable, onEdit, onOpen]);
  return <DataTable caption={tableCaption(mode)} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

<<<<<<< HEAD
function applicationColumns(mode: CommerceWorkspaceMode, onOpen: (record: Application) => void): readonly DataColumn<Application>[] {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
interface ApplicationActions {
  readonly canEdit: boolean;
  readonly canCopy: boolean;
  readonly onOpen: (record: Application) => void;
  readonly onEdit: (record: Application) => void;
  readonly onCopy: (record: Application) => void;
  readonly onDisable: (record: Application) => void;
}

function applicationColumns(mode: CommerceWorkspaceMode, actions: ApplicationActions): readonly DataColumn<Application>[] {
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return Object.freeze([
    {
      key: 'identity',
      label: mode === 'design' ? '当前店铺应用' : '商城 / 应用',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      render: (row) => (
        <div className="commerceidentity">
          <span className="commerceappmark" aria-hidden="true">
            店
          </span>
          <span>
            <button type="button" onClick={() => actions.onOpen(row)} aria-label={`查看${row.name}摘要`}>
              {row.name}
            </button>
            <code>{row.code}</code>
          </span>
        </div>
      ),
<<<<<<< HEAD
=======
      render: (row) => <div className="commerceidentity">
        <span className="commerceappmark" aria-hidden="true">店</span>
        <span><button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}摘要`}>{row.name}</button><code>{row.code}</code></span>
      </div>,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    },
    {
      key: 'binding',
      label: '商城 / 商品池',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      render: (row) => (
        <div className="commercebinding">
          <span>{row.mall_id ?? '未绑定商城'}</span>
          <code>{row.pool_id ?? '未绑定商品池'}</code>
        </div>
      ),
<<<<<<< HEAD
=======
      render: (row) => <div className="commercebinding"><span>{row.mall_id ?? '未绑定商城'}</span><code>{row.pool_id ?? '未绑定商品池'}</code></div>,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    },
    {
      key: 'draft',
      label: '装修草稿',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      render: (row) => (
        <div className="commerceversion">
          <strong>{row.head_sequence === null || row.head_sequence === undefined ? '—' : `v${row.head_sequence}`}</strong>
          <span className={`commercestate is-${validationTone(row.head_validation_state)}`}>
            <i aria-hidden="true" />
            {validationLabel(row.head_validation_state)}
          </span>
        </div>
      ),
<<<<<<< HEAD
=======
      render: (row) => <div className="commerceversion"><strong>{row.head_sequence === null || row.head_sequence === undefined ? '—' : `v${row.head_sequence}`}</strong>
        <span className={`commercestate is-${validationTone(row.head_validation_state)}`}><i aria-hidden="true" />{validationLabel(row.head_validation_state)}</span></div>,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    },
    {
      key: 'publication',
      label: '发布 / 域名',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      render: (row) => (
        <div className="commercepublication">
          <strong>{publicationLabel(row)}</strong>
          <span>{row.domain ?? '域名未绑定'}</span>
        </div>
      ),
<<<<<<< HEAD
=======
      render: (row) => <div className="commercepublication"><strong>{publicationLabel(row)}</strong><span>{row.domain ?? '域名未绑定'}</span></div>,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    },
    {
      key: 'status',
      label: '经营状态',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      render: (row) => (
        <span className={`commercestate is-${applicationStatusTone(row.status)}`}>
          <i aria-hidden="true" />
          {applicationStatusLabel(row.status)}
        </span>
      ),
<<<<<<< HEAD
    },
    { key: 'updated', label: '更新时间', render: (row) => <time>{formatDate(row.updated_at)}</time> },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <div className="commercebinding">
          <button className="commercerowaction" type="button" onClick={() => actions.onOpen(row)} aria-label={`查看${row.name}`}>
            查看
          </button>
          {actions.canEdit ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onEdit(row)} aria-label={`编辑${row.name}`}>
              编辑
            </button>
          ) : null}
          {actions.canCopy ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onCopy(row)} aria-label={`复制${row.name}`}>
              复制
            </button>
          ) : null}
          {actions.canEdit && row.status.toLowerCase() !== 'disabled' ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onDisable(row)} aria-label={`停用${row.name}`}>
              停用
            </button>
          ) : null}
        </div>
      ),
    },
=======
      render: (row) => <span className={`commercestate is-${applicationStatusTone(row.status)}`}><i aria-hidden="true" />{applicationStatusLabel(row.status)}</span>,
    },
    { key: 'updated', label: '更新时间', render: (row) => <time>{formatDate(row.updated_at)}</time> },
    { key: 'action', label: '操作', render: (row) => <button className="commercerowaction" type="button" onClick={() => onOpen(row)}>查看</button> },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    },
    { key: 'updated', label: '更新时间', render: (row) => <time>{formatDate(row.updated_at)}</time> },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <div className="commercebinding">
          <button className="commercerowaction" type="button" onClick={() => actions.onOpen(row)} aria-label={`查看${row.name}`}>
            查看
          </button>
          {actions.canEdit ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onEdit(row)} aria-label={`编辑${row.name}`}>
              编辑
            </button>
          ) : null}
          {actions.canCopy ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onCopy(row)} aria-label={`复制${row.name}`}>
              复制
            </button>
          ) : null}
          {actions.canEdit && row.status.toLowerCase() !== 'disabled' ? (
            <button className="commercerowaction" type="button" onClick={() => actions.onDisable(row)} aria-label={`停用${row.name}`}>
              停用
            </button>
          ) : null}
        </div>
      ),
    },
>>>>>>> 018b2a71 (chore(release): capture current production source)
  ]);
}

function tableCaption(mode: CommerceWorkspaceMode): string {
  if (mode === 'governance') return '应用治理列表';
  if (mode === 'design') return '店铺装修应用';
  return '集团商城列表';
}
