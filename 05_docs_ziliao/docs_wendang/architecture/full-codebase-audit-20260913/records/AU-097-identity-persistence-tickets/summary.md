# AU-097｜Identity 持久化、认证票据与 principal 适配器深审

WeChat binding 在同一数据库操作中锁定可用 grant/identity，拒绝应用与账号冲突，以活动 membership 条件写入 federated identity 后消费 grant。atomicIdentityMutation 以 savepoint 保证局部拒绝不会污染外层事务；identityTransaction 设置 API database context 后提交或回滚。

PgAuthTicket 的交换同时比较 ticket/state/nonce/PKCE/session/account realm 条件，在 ticket 行锁内设置 consumed_at。member import 只通过受控 identity.ensure_imported_principal 函数创建 pending principal。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
