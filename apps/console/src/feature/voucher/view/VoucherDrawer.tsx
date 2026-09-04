import { Button, Drawer } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { VoucherRecord, VoucherView } from '../model/Voucher';
import { formatRecordAmount } from './VoucherTable';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';

export interface VoucherDrawerAction {
  readonly label: string;
  readonly tone?: 'default' | 'primary' | 'danger';
  readonly run: () => void;
}

export function VoucherDrawer({ record, view, actions, onClose }: Readonly<{ record?: VoucherRecord; view: VoucherView; actions: readonly VoucherDrawerAction[]; onClose: () => void }>) {
  return (
    <Drawer open={record !== undefined} title={record?.name ?? `${voucherViewMeta[view].label}摘要`} onClose={onClose}>
      {record ? (
        <div className="voucherdrawerbody">
          <code>{chineseReference(voucherViewMeta[view].short, record.id)}</code>
          <section className="voucherdrawerstatus">
            <span className={`voucherstate is-${voucherStateTone(record.state)}`}>
              <i aria-hidden="true" />
              {voucherStateLabel(record.state)}
            </span>
            <p>数据来自当前管理范围的服务端读模型，不推断未返回字段。</p>
          </section>
          <dl className="voucherfacts">
            <div>
              <dt>业务详情</dt>
              <dd>{record.detail}</dd>
            </div>
            <div>
              <dt>数量</dt>
              <dd>{record.quantity === null ? '—' : new Intl.NumberFormat('zh-CN').format(record.quantity)}</dd>
            </div>
            <div>
              <dt>金额</dt>
              <dd>{formatRecordAmount(record)}</dd>
            </div>
            <div>
              <dt>服务端时间</dt>
              <dd>{formatDate(record.occurredAt)}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>{record.version === null ? '—' : `第 ${record.version} 版`}</dd>
            </div>
          </dl>
          {actions.length ? (
            <footer>
              {actions.map((action) => (
                <Button key={action.label} tone={action.tone ?? 'default'} onPress={action.run}>
                  {action.label}
                </Button>
              ))}
            </footer>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
