const labels: Readonly<Record<string, string>> = Object.freeze({
  active: '生效',
  inactive: '停用',
  applied: '待审核',
  disqualified: '已取消资格',
  pending: '待结算',
  available: '可结算',
  settled: '已结算',
  reversed: '已冲正',
  requested: '已申请',
  processing: '处理中',
  paid: '已付款',
  failed: '失败',
});

export function ReferralState({ value }: Readonly<{ value: string }>) {
  return (
    <span className="referralstate" data-state={value}>
      {labels[value] ?? '待识别状态'}
    </span>
  );
}
