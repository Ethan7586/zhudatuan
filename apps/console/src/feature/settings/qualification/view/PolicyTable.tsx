import { Button } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { QualificationPolicy } from '../model/Policy';
import type { QualificationViewModel } from '../viewmodel/QualificationViewModel';

export function PolicyTable({ rows, model }: Readonly<{ rows: readonly QualificationPolicy[]; model: QualificationViewModel }>) {
  return (
    <div className="qualificationtablewrap">
      <table className="qualificationtable">
        <thead>
          <tr>
            <th>资格策略</th>
            <th>状态</th>
            <th>生效版本</th>
            <th>规则摘要</th>
            <th>发布时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <small>{chineseReference('策略', row.id)}</small>
              </td>
              <td>
                <span className={`qualificationstate is-${row.status}`}>{chineseDomainLabel(row.status)}</span>
              </td>
              <td>{row.activeVersion === null ? '尚未发布' : `v${row.activeVersion}`}</td>
              <td>{row.rule === null ? '无生效规则' : `${Object.keys(row.rule).length} 个顶层字段`}</td>
              <td>{formatDate(row.publishedAt)}</td>
              <td>
                <div className="qualificationrowactions">
                  {model.canManage ? <Button onPress={() => model.actions.publish(row)}>发布新版</Button> : null}
                  {model.canManage && row.activeVersion !== null && row.versions.some((version) => version.version !== row.activeVersion) ? <Button onPress={() => model.actions.rollback(row)}>回滚</Button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
