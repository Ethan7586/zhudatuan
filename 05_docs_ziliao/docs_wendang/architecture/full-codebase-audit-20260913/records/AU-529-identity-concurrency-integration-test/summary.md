# AU-529｜Identity L0/L1 PostgreSQL 并发集成测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/IdentityConcurrency.test.ts`（662 行）；定向追踪 identity registration/management operations、MemberPort storefront binding与数据库 evidence 查询。
- 审阅方式：逐关键逻辑人工阅读；测试需要 admin/runtime/app 三个 PostgreSQL endpoint，本轮未执行。

## 真实运行关系

三类 DB connection → identity registration/management operation composition → L0/L1 realm account/credential/membership/session writes。测试并发执行 100 注册/登录、同手机号跨 realm、20 路 idempotency、password-reset challenge、邀请领取与 auth ticket exchange；每段以直接 SQL 核对账户/凭据/会话/Realm/consumed 状态及无 cross-realm write。

## 审计结论

- **G0**：这是实际多连接 PostgreSQL concurrency test，覆盖身份数据隔离、single-use credential/challenge/invite/ticket 和 idempotency，不是 mock 或历史样例。不能删除。
- **NIT F-0253**：六类独立竞态与大段 fixture/evidence 被置于一个 662 行 test；任一失败会中断后续场景、定位和重跑成本较高。建议未来仅在专门测试维护小批次中按竞态分 case/共享 fixture；不影响当前语义。

## 未验证项

- 当前未连接真实 test endpoints；数据库初始数据、迁移 head、性能/lock/connection-pool 上限和 test cleanup 在实际环境未验证。
