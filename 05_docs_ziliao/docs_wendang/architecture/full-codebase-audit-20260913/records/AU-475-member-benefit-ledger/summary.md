# AU-475｜成员权益台账读取契约

- 主审 `20260821068000_add_member_benefit_ledger.sql`（31 行），并人工反查 BenefitOperations、benefit/finance 数据模型、SDK 与 contract 声明；未执行迁移、数据库查询或线上验证。
- 迁移发布 `GET /api/v1/benefits/ledgers`：member audience、`benefit.read` permission、capability/entitlement 和 schema checksum 同步注册并断言。
- 当前 handler 仅由 server-derived membership ID 联结该 member 的 benefit account，再联结该 account 的 finance account、已 posted journal 与 finance entry；采用 `(posted_at, entry.id)` keyset 分页。请求不提供 account、member、order 或 scope 标识，因而不能选择他人台账。
- **G0**：此 registry 是 SDK、contract、module manifest 和实际台账读取 handler 的共同 API 事实。资金/权益双账及历史迁移的高风险保留已由 **GX-0012** 覆盖；本轮未发现新增 P0–P3。未验证极大金额的 API 表示精度、线上 RLS、benefit account 与 finance account 的全量对账或发布 target。
