import { Button } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { QualificationCase } from '../model/Qualification';
import type { QualificationCaseViewModel } from '../viewmodel/QualificationCaseViewModel';

export function QualificationTable({ rows, model }: Readonly<{ rows: readonly QualificationCase[]; model: QualificationCaseViewModel }>) {
  return (
    <section className="qualificationsection" aria-labelledby="qualificationcasestitle">
      <header>
        <div>
          <p>材料核验 · 有效期 · 自动风险联动</p>
          <h2 id="qualificationcasestitle">经营资质</h2>
        </div>
        <span>{rows.length} 项</span>
      </header>
      {rows.length === 0 ? (
        <div className="qualificationempty">
          <strong>还没有已登记的经营资质</strong>
          <p>上传许可证、授权书或协议后再发布；到期或撤销会立即阻止新交易并触发相关商品下架。</p>
        </div>
      ) : (
        <div className="qualificationtablewrap">
          <table className="qualificationtable">
            <thead>
              <tr>
                <th>资质</th>
                <th>主体</th>
                <th>适用范围</th>
                <th>状态</th>
                <th>有效期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <small>{chineseReference('资质', row.id)} · {row.evidenceCount} 份材料</small>
                  </td>
                  <td>{targetLabel(row.subject.kind)} · {row.subject.id}</td>
                  <td>{row.applicability.map((item) => `${targetLabel(item.kind)} ${item.id}`).join('；')}</td>
                  <td><span className={`qualificationstate is-${row.state}`}>{stateLabel(row.state)}</span></td>
                  <td>{formatDate(row.effectiveAt)} 至 {formatDate(row.expiresAt)}</td>
                  <td>{model.canRevoke && row.state === 'published' ? <Button tone="danger" onPress={() => model.actions.openRevoke(row)}>撤销</Button> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function targetLabel(kind: QualificationCase['subject']['kind']): string {
  return { partner: '合作方', product: '商品', category: '类目', region: '区域' }[kind];
}

function stateLabel(state: QualificationCase['state']): string {
  return { draft: '草稿', verified: '已核验', published: '已生效', revoked: '已撤销', expired: '已到期' }[state];
}
