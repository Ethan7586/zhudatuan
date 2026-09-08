# 发票运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Invoice 创建/开具停滞、Basis 与结算不一致、外部票号 Unknown、重复发票、作废/红冲失败或 Deadletter 时触发。开票延迟为 P1；重复/超额开票、错误抬头泄露或账务不一致为 P0。

## Owner 与前置权限

Finance Owner 主责，Tax/Invoice Provider、Settlement、Approval、Security 与 Support 协同。请求必须绑定冻结 Settlement/Order Basis Hash、金额/税额/币种、抬头引用、审批 Proof 和稳定发票业务号；敏感抬头与税号不写日志。

## 只读诊断（Diagnosis）

核对可开票 Basis、已开/已申请/已红冲累计金额、Settlement/Journal、Invoice Intent/Attempt、外部业务号/票号 Hash、Provider 查询、PDF 对象扫描/签名、Delivery Receipt 和 Job Checkpoint。外部超时为 Unknown，不能新建发票重试。

## 止血（Stop loss）

冻结受影响 Basis 的新开票和下载，保留已签名发票；撤销可疑签名 URL，隔离错误 Provider/模板。禁止改发票状态、票号、金额、PDF 或删除历史。

## 恢复（Recovery）

以原 InvoiceId/外部业务号查询 Provider；成功则幂等补录 Receipt/PDF，失败才按同意图重试。错误已开票通过合法作废/红冲，再建立新 Invoice；Delivery 失败只重发通知，不重复开票。人工接管需 Tax/Finance 双人确认。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明累计有效发票金额/税额不超 Basis、业务号/票号唯一、Settlement/Journal 一致、PDF Hash/签名/对象权限正确、一次性下载和回执完整。Data repair 只用作废/红冲/重开；Escalation 重复/泄露 P0；Audit 保存 Hash 和回执不保存敏感正文。

## 回滚边界

未提交 Intent 可取消；已开票不可删除/改写，通过作废或红冲形成新事实。已发送 PDF 链接撤销后发行新链接，不恢复旧 Token。

## 沟通模板

“发票事件 `{incidentId}`，Invoice/Basis `{invoiceId}/{basisId}`，金额 `{amountMinor}`，Provider 状态 `{state}`，客户影响 `{impact}`，人工接管 `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 Unknown 有结论；金额/税额/Basis/Settlement/Journal 守恒；票号和 PDF Hash 唯一正确；下载/通知安全；告警和审计关闭。

## 复盘链接（Postmortem）

重复/超额开票、PII 泄露、Provider Unknown 超 SLA 或账务不一致必须填写 `{postmortemUrl}`。
