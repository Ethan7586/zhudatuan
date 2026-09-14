# AU-094｜Identity 公开端口与异步边界深审

IdentityNotificationPort 读取仍有效的 challenge 密文，并用单条 SQL 在发送前把上一笔 sending 标记为 ambiguous。成功、失败和未知结果只允许从 sending 终结；失败与未知同时登记 identity owner deadletter。

RuntimeJobs 通过 IdentityRetentionPort 只执行数据库 purge 函数。Member import 仅依赖 IdentityPrincipal.ensurePending；WechatIdentity 是由 CommerceRuntime 与 identity registration runtime 注入的容器 token。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
