# RV-0024｜券资金写入动作权限独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应首审：F-0241
- 结论：**确认数据库授权缺口，定级 P2；未发现 P0。**
- 方法：从迁移 ledger、函数guard/grant、全仓静态调用者和数据库权限测试重新取证。

## 迁移与权限边界

`20260820110000_voucher_operations_foundation.sql`建立了七个高风险`security definer` RPC：备券申请、审批、发行、状态变更、核销、核销冲正和作废保留对账。它同时定义了每项动作权限并将其分给不同券角色。

函数均撤销`public`、`anon`和`authenticated`的execute，只授予`service_role`。后续迁移没有重定义任何一个函数。`api_membership_has_permission`和`api_authorization_evidence_matches`随后已经存在且被其他资金操作使用，但这七个函数没有接入它们。

## 主样本与差异核验

深读`api_create_voucher_reserve_authorized`：它验证输入、membership与操作者一致、目标范围、幂等和审计，但不验证`voucher.reserve.create`。对余下六个函数逐个核对相同维度，均只使用membership/范围guard，不含动作permission或授权凭证检查。没有把重复函数逐份作全文复读。

## 可达性与结论

全仓静态检索没有找到任何HTTP、Worker、SDK或脚本调用这七个RPC；唯一额外引用是一个数据库权限闭包测试。故不能证明低权限成员能在当前固定基线取得service-role调用，也不能证明线上发生余额或账本篡改。

缺口本身真实：任何未来或仓外service-role调用者若仅传入同范围membership，就会绕过职责分离。由于实际可达性未证实，按保守标准从首审P1候选降为P2。后续治理应在最新主线的单独修复分支中，为每个RPC接入对应permission与授权凭证检查，并在隔离数据库对允许/拒绝矩阵、幂等、余额、审计和回滚逐项验证。
