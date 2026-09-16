# AU-643｜Initialize Storefront Qualification

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903105000_initialize_storefront_qualification.sql`（69 行）。
- 审阅方式：逐行人工审阅 membership trigger、caller role guard、qualification schema key、registration path和 qualification/checkout consumers。未连接数据库或执行 migration。

## 审计结论

- **G0：保留，但存在 P2 多 Mall 资格档案模型冲突。** trigger 为 identity API 新建 active storefront membership 创建一个 phone-registration qualification profile；但 qualification profile 以 member ID 为主键，不能同时拥有第二个 Mall scope。
- [FACT][E-AU-643-001] trigger 仅在 `zhudatuanidentityapi`、active storefront membership 和 active Mall 下执行，并以 caller-managed `security definer` 写入，函数对所有 runtime role revoke execute；其副作用范围受精确限定。
- **F-0270（P2）**：`qualification.profile.member_id` 是主键而非 `(member_id,scope_id)`；trigger 的 `on conflict(member_id) do nothing` 使已在 Mall A 有 profile 的同一 member 注册 Mall B 时不创建 B scope profile。RegistrationOperations 明确允许同一 resolved member/account 按 `member_id + organization_id + client` 创建另一 storefront membership；QualificationOperations 和 QuoteReader 均要求 profile.scope_id 等于 current Mall，导致 B 的 qualification decision/checkout context 不再有该 member 的 scope-local profile。

## 未验证项

- 未在隔离数据库创建同一 member 的两条 Mall storefront membership 并调用资格 preview/quote；未取得生产回执。
- 未确认产品是否明确禁止同一 member 参与多个 Mall；当前 registration query、provisioned Mall invite model 与 per-Mall role 设计均未建立该禁止约束。

## 结论等级

- 新增问题：P2 1 项（F-0270）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：需要；复核者须独立追踪所有 qualification/profile/tag/policy 的 key 和 scope 语义，并用双 Mall fixture 验证注册、preview、quote 与迁移策略。
