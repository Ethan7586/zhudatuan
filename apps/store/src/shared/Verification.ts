import { operatorCollection as displayCollection, operatorItems as dataItems, operatorRow as displayRow, operatorText as recordText } from '@shop/presentation/operator';

export function verificationHistory(value: unknown) {
  return displayCollection(
    value,
    dataItems(value).map((item) =>
      displayRow({
        key: recordText(item, 'id'),
        title: recordText(item, 'purpose') === 'voucher_redeem' ? '凭证核销' : '身份核验',
        detail: `对象 ${short(recordText(item, 'subject_id'))} · ${reason(recordText(item, 'reason'))}`,
        statusLabel: verificationStatus(recordText(item, 'result')),
        timestamp: recordText(item, 'attempted_at'),
      })
    )
  );
}

function reason(value: string): string {
  return ({ verified: '服务端确认通过', device_denied: '设备未登记', token_unavailable: '凭证无效或已使用', attempt_limit: '尝试次数过多' } as Readonly<Record<string, string>>)[value] ?? '服务端已拒绝';
}

function short(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function verificationStatus(value: string): string {
  if (value === 'accepted') return '核销成功';
  if (value === 'rejected') return '核销失败';
  if (value === 'replayed') return '重复核销';
  return value === 'expired' ? '凭证已过期' : '状态待确认';
}
