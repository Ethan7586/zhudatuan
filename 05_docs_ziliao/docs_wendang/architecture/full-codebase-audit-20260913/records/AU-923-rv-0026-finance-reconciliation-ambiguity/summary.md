# RV-0026｜财务对账歧义候选独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应首审：F-0252
- 结论：**确认匹配缺陷，定级 P2；未发现 P0。**
- 方法：从statement匹配SQL重新追至reconciliation状态和结算快照，不以跳过的测试替代运行链证据。

## 匹配事实

`ReconcileStatement.match()`将支付、退款、履约和账务事实合并为候选，再以`distinct on(line_id)`及`priority, internal_id`选择一条。候选不唯一且金额相等时，系统把内部ID排序第一条静默写为`matched`；没有歧义reason code。已有多对一拒绝场景仍处于skip状态。

这会让对账项目、net汇总和reconciliation状态把歧义显示为已匹配，即使业务上没有确定的唯一对应关系。

## 下游边界

`CloseSettlement.decide()`在任何账务写入前调用`SettlementSnapshot`。快照仅接纳`matched`、无reason且具有`journalReferenceType`为成功支付/退款和`settlementEligible===true`的项目。`match()`写入的evidence只含外部引用、种类、原始hash与source；不含上述字段。因此此来源的歧义项会使结算快照得到空payable集合并抛`FINANCE_SETTLEMENT_SOURCE_STALE`，fail-closed。

## 结论边界

歧义项目仍可能误导人工审核和对账状态，属于真实财务正确性问题；但固定代码已在结算账务前阻断该来源，无法支持“会直接错误结算”的P1。故从P1候选降为P2。

未访问生产候选数据、审批记录或结算运行日志，不能确认实际歧义出现次数或用户影响。后续修复应在最新主线的独立批次中把多候选写成不可审批difference并启用对应回归测试，同时覆盖唯一候选和结算拒绝路径。
