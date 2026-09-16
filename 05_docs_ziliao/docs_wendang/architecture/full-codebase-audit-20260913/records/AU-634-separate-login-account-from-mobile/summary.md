# AU-634｜Separate Login Account From Mobile

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902137000_separate_login_account_from_mobile.sql`（125 行）。
- 审阅方式：逐段人工审阅精确前置条件、function definition rewrite、bootstrap 审计证据恢复、collision/failure guard 和最终 privilege/ledger assert；交叉检查 Owner bootstrap 审计写入、owner mobile runtime 调用以及应用层契约。未连接数据库、执行 migration 或使用真实手机号。

## 审计结论

- **G0：保留。** 本 migration 将 Owner 手机变更从密码 credential subject 的更新中拆出，保持 account/profile mobile 生命周期与 password login subject 分离，并只对具有唯一 bootstrap 审计证据的既有 Owner 恢复初始 subject。
- [FACT][E-AU-634-001] migration 精确要求 AU-633 ledger/checksum；以 `regprocedure` 读取 owner mobile function，只允许删除一次完整 credential subject update，rewrite 后再断言旧 SQL 已不存在。
- [FACT][E-AU-634-002] 既有数据修复读取唯一 `identity.owner.bootstrapped` audit evidence 的 principal 与 64 位 subject fingerprint；存在多条、格式错误、另一 active principal 冲突、恢复多行或遗留候选时均 fail-closed。无该 bootstrap evidence 时明确不触碰数据。
- [FACT][E-AU-634-003] `MobileWechatOperations` 的 Owner 路径仍原子调用该 function，并由 exact-owner、phone-change challenge、password/step-up、session/account locks 与 mobile uniqueness path 前置；migration 仅移除 Owner credential mutation，未删除手机 profile/account 更新、assurance 轮换与会话撤销。
- [FACT][E-AU-634-004] 最终 assert 同时验证 rewrite 结果、`zhudatuanidentityapi` execute privilege 与本 migration ledger；其 identity runtime caller role 已由 AU-632 收敛，未发现本文件自身的新入口或 ACL 断链。

## 未验证项

- 未在隔离 PostgreSQL 构造并执行 bootstrap evidence 的零条、唯一合法、重复、冲突和多 credential 候选矩阵；恢复的实际存量行数未知。
- 未验证历史 Owner 是否存在不带 bootstrap audit evidence 的遗留账号；该分支按设计不作自动恢复，不能据此推断数据异常。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；若执行该迁移或准备处理存量异常，需由数据所有者先在隔离备份上核对 audit evidence 与候选 credential。
