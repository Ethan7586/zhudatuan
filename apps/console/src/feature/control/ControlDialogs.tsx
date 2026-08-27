import { Button, Dialog } from '@shop/design';
import type { ControlAudit, ControlChange, ControlIncident } from './ControlSchema';

export function EvidenceDialog({ incident, onClose }: Readonly<{ incident: ControlIncident | undefined; onClose: () => void }>) {
  return <Dialog open={incident !== undefined} title="处置证据" {...(incident === undefined ? {} : { eyebrow: incident.id })} onClose={onClose}>
    {incident === undefined ? null : <div className="controlevidence">
      <dl><div><dt>事项</dt><dd>{incident.title}</dd></div><div><dt>影响</dt><dd>{incident.impact}</dd></div>
        <div><dt>可能原因</dt><dd>{incident.cause ?? '服务端尚未给出已验证原因'}</dd></div>
        <div><dt>影响能力</dt><dd>{incident.affectedCapabilities.join('、') || '未返回'}</dd></div></dl>
      <p>证据只来自服务端观测与审计读模型；本界面不在浏览器补造诊断结论。</p>
    </div>}
  </Dialog>;
}

export function RecoveryDialog({ incident, confirmed, onConfirm, onClose }: Readonly<{
  incident: ControlIncident | undefined;
  confirmed: boolean;
  onConfirm: () => void;
  onClose: () => void;
}>) {
  return <Dialog open={incident !== undefined} title={confirmed ? '恢复请求待执行' : '恢复影响预览'} eyebrow="PREVIEW → CONFIRM → STEP-UP" onClose={onClose} dismissable={!confirmed}>
    {incident === undefined ? null : confirmed ? <div className="recoveryreceipt" role="status">
      <strong>预览与确认已完成</strong><p>正式 Execute 必须由 action-bound proof、幂等键和期望版本闭合后提交；本地视觉验收不会伪造执行成功。</p>
      <Button onPress={onClose}>关闭</Button>
    </div> : <div className="recoverypreview">
      <p>即将为“{incident.title}”发起恢复流程。</p><ul><li>{incident.impact}</li><li>Owner：{incident.owner ?? '待指派'}</li>
        <li>执行前将重新读取状态并要求 Step-up。</li></ul>
      <div><Button onPress={onClose}>取消</Button><Button tone="primary" onPress={onConfirm}>确认并进入 Step-up</Button></div>
    </div>}
  </Dialog>;
}

export function ChangeDialog({ action, change, onClose }: Readonly<{
  action: 'plan' | 'pause' | 'rollback' | undefined;
  change: ControlChange | undefined;
  onClose: () => void;
}>) {
  const title = action === 'rollback' ? '回滚影响预览' : action === 'pause' ? '暂停变更确认' : '变更计划';
  return <Dialog open={action !== undefined && change !== undefined} title={title} onClose={onClose}>
    {change === undefined ? null : <div className="changepreview"><strong>{change.title}</strong><p>目标：{change.target}</p>
      <p>停止条件：{change.stopCondition}</p><p>预计回滚：{change.rollbackEstimate}</p>
      {action === 'plan' ? null : <p>正式动作需要 Preview、Step-up、Execute 与结果重读，本地验收只展示确认边界。</p>}
      <Button onPress={onClose}>关闭</Button></div>}
  </Dialog>;
}

export function AuditDialog({ open, audits, onClose }: Readonly<{
  open: boolean;
  audits: readonly ControlAudit[];
  onClose: () => void;
}>) {
  return <Dialog open={open} title="完整审计记录" onClose={onClose}>
    <div className="auditdialog"><ol>{audits.map((audit) => <li key={audit.id}>
      <time>{audit.time}</time><strong>{audit.title}</strong><span>{audit.detail}</span>
    </li>)}</ol><Button onPress={onClose}>关闭</Button></div>
  </Dialog>;
}
