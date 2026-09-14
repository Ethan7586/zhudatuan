# AU-702｜SFL 公司模板克隆

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912200000_create_sfl_company_template_clone.sql`（379 行）、Provisioning `CloneCompanyTemplate`/`CompanyTemplateCloneWorkflow`、其单元测试、PostgreSQL 17 fixture 与 SQL contract。
- 审阅方式：深入审阅克隆拓扑、身份/成员关系、幂等与回滚、shared-host/pending binding 边界、function ownership/grant、调用者输入来源及定向 PostgreSQL 验收；同构单元测试仅结构性审阅。

## 审计结论

- **GX：禁止删除或就地简化。** `organization.clone_company_template` 是一项高权限 topology/identity provisioning boundary：创建独立 enterprise/Mall/Realm/node、克隆配置及创建 target membership/bindings。即使仓内尚未发现注册 HTTP/operation 调用者，它仍授予 `zhudatuanwebapi` 直接 execute，并由 database contract/fixture 维护；其外部调用与发布职责未排除。
- [FACT][E-AU-702-001] function 只克隆 organization、Hosted node/Realm、target account/membership、scope、catalog pool/experience application/config 与 pending binding；它不复制 orders、payments、refunds、finance、fulfillment、inventory、sessions 或 credentials，并明确写 `infrastructure_action_count=0`。
- [FACT][E-AU-702-002] 定向命令 `npm run check:sfl-company-template-clone` 通过：完整独立 company、shared Hosted kernel、cross-Realm membership isolation、idempotency/replay、两处注入回滚、无 business-history copy 和 source immutability 均通过。
- **F-0285：P2。** `security definer` function向 `zhudatuanwebapi` 直接开放 execute，但 source realm/member/principal 均由 request JSON提供；函数只验证三者在数据库中彼此相符，未将它们绑定到当前数据库 session actor/membership/scope/capability。现有应用 adapter同样逐字转发输入，PG17 contract未以运行 role或不匹配 session身份验证拒绝路径。

## 未验证项

- 固定基线的非测试应用、route、worker、script未找到注册 `CompanyTemplateCloneWorkflow` 的 consumer；无法据此断言不存在仓外 Web/API consumer或直连 database caller。
- 未读取生产 role inheritance、connection-pool session variables、`pg_proc.proconfig` 或线上 function owner；未断言已经发生越权克隆。

## 结论等级

- 新增问题：F-0285（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：GX 1 项；不新增 G1/G2/G3。
- 二次复核：是；必须以真实 `zhudatuanwebapi` role建立同源 actor allow、actor/member/source不匹配 deny、空 session deny及 direct invocation matrix，并独立确认预期的 operator capability 和 API entry registration。
