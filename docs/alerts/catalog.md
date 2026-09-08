# 告警目录

阈值、窗口、严重级、Owner 与 Runbook 的机器权威是 [`config/telemetry.yml`](../../config/telemetry.yml)；规则由 [`infrastructure/monitoring/Alerts.yml`](../../infrastructure/monitoring/Alerts.yml) 生成，禁止在监控供应商控制台另建漂移副本。没有 Owner、现存 Runbook、Dashboard、最近变更、Trace 安全查询和止血动作的告警构建失败。

| Alert ID | 业务影响与判定 | 安全自动保护 | Dashboard / Runbook |
| --- | --- | --- | --- |
| `servicelevelburn` | 核心 Operation 在短/长窗口快速消耗错误预算 | 停止放量与非必要发布，保留现有健康版本 | Runtime / `deployment.md` |
| `paymentunknown` | 支付结果超过查询时限仍 Unknown，存在重复扣款或漏确认风险 | 停止同意图再次扣款，只允许 Provider Query 恢复 | Transaction / `paymentquery.md` |
| `inventoryconflict` | 冲突率越界或出现负库存/已接受超卖 | 暂停受影响 Listing 写入，保留查询与证据 | Salechain / `inventoryimport.md` |
| `ledgerimbalance` | 任一已提交 Journal 借贷不平，目标恒为 0 | 阻断结算、提现、发票和关账 | Finance / `reconciliation.md` |
| `voucherbatchfailure` | 生成/导入/发放批次失败或进度停滞 | 暂停对应批次新分片，保留已提交 Checkpoint | Voucher / `voucherissue.md` |
| `importfailure` | 六类 Import 错误率或积压越界 | 限制新低优先级导入，不中断交易队列 | Runtime / `catalogimport.md` |
| `outboxbacklog` | Outbox 最旧未发布时间或 Deadletter 越过 SLO | 暂停受影响分区的派生消费，保留权威事务 | Runtime / `outbox.md` |
| `providercapabilityfailure` | 单 Provider 熔断、超时或同步水位落后 | 隔离该连接并切只读/排空，其余 Provider 不受影响 | Provider / `providerhealth.md` |
| `releasefailure` | 签名、迁移、Canary、合同硬切、六端制品或不变量门禁失败 | 自动停止流水线；Retire 前恢复已签名旧版本 | Runtime / `deployment.md` |
| `securityincident` | 跨 Scope、凭据泄漏、PII 出口、签名/完整性异常 | 撤销受影响会话/租约，冻结相应能力并保全证据 | Identity / `securityincident.md` |
| `entryfailure` | 商城入口解析失败率越界 | 保持旧 Publication Head，不发布无效入口 | Salechain / `mallentry.md` |
| `entryinvalid` | 域名、应用或 Publication 绑定不合法 | 阻断 Head 切换 | Salechain / `mallentry.md` |
| `sessionmallmismatch` | 会话与 Mall Scope 不匹配 | 拒绝请求并撤销异常会话 | Identity / `sessioncompromise.md` |
| `approvaloverdue` | 审批任务超过 SLA 或 Proof 过期 | 升级到替补审批人，不代替审批决定 | Identity / `approval.md` |
| `reconciliationdifference` | 冻结 Watermark 下差异未在时限内归零 | 阻断对应结算周期 | Finance / `reconciliation.md` |

所有通知载荷只包含 AlertId、时间、环境、Release、聚合信号值、阈值版本、Dashboard、最近变更、Trace Exemplar、Runbook、Owner、止血动作与 Evidence Hash。严禁包含 Authorization、Cookie、Secret、Token、OTP、请求正文、完整手机号/地址、卡密或附件正文。

SLO 告警采用短窗口和长窗口 Burn Rate 联合判断，业务不变量告警按一次命中立即触发；不对单机瞬时 CPU 抖动直接呼叫人员，资源信号只有在持续影响服务 SLI 或容量门槛时升级。
