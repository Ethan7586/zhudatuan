# AU-683｜Node Mall Operator Invitations

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911180000_allow_node_mall_operator_invitations.sql`（159 行）。
- 审阅方式：深入审阅。核对 member.invite 的 select/insert/update RLS、前序 Owner/Senior predicate、Identity invitation create/revoke runtime 和测试；未重复审阅 invitation 密码/注册码消费状态机。

## 审计结论

- **G0：保留。** migration 把 operator invite 的 logical tenant ownership 与实际 node Mall storefront 绑定分开表达；不能因历史固定 `mall-zhudatuan` 名称而当作遗留代码。
- [FACT][E-AU-683-001] operator invite 必须属于 `tenant-zhudatuan`、指向一个 active descendant Mall、绑定单次目标手机号、只能使用 pending-operator 或 tenant-scoped Senior role；三条 policy 都以 unitclosure 验证 tenant→Mall 关系。
- [FACT][E-AU-683-002] Identity runtime 在 Mall scope 下先把 database `app.scope_id` 设为 invitation tenant scope，再只接受一个可访问 Mall；insert 同时保存 tenant organization 和 selected storefront organization，和 RLS model 一致。
- [FACT][E-AU-683-003] create/revoke policy 均再调用 AU-682 的 Owner/Senior permission/deny-override predicate；普通 administrator 在 application test 侧被拒绝，Senior/transfer Owner 仅在其预期分支被允许。
- 当前 TypeScript tests 为 handler/mock SQL 和 migration source assertions，未实际执行 PostgreSQL RLS allow/deny matrix；此与既有 **F-0268** 是同一缺口，不新增重复问题。

## 未验证项

- 未在隔离 PostgreSQL 以 Identity API role 及真实 session variables 重放 cross-tenant、disabled Mall、wrong destination、ordinary administrator、Senior、projected Owner 与 revoke/update 反事实矩阵。

## 结论等级

- 新增问题：无；关联既有 F-0268。无 P0。
- 垃圾代码：G0 1 项（node Mall operator invitation RLS）；不新增 G1/G2/G3/GX。
- 二次复核：否；随 F-0268 的数据库契约批次复核。
