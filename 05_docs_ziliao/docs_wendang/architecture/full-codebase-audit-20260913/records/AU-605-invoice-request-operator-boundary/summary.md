# AU-605｜发票申请 Operator 边界恢复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829215000_restore_invoice_request_operator_boundary.sql`（100 行）。
- 审阅方式：逐行人工审阅 database/checksum guard、operation audience 更新、resource scope rewrite 与 assert；交叉检查 Finance invoice request/read operations、OperationController 和 registration migration plan。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 该 migration 修复 AU-604 的 broad member-audience alignment 曾将 `invoice.requests.create` 错纳入 member operation 的历史问题，恢复为 Operator + organization scope；不能删除。
- [FACT][E-AU-605-001] 只有 AU-604 的精确 predecessor、无 future head、且 runtime contract checksum 等于指定值才可执行；未知 predecessor fail closed。
- [FACT][E-AU-605-002] `capability.operation` 将 `invoice.requests.create` 从 member 改回 operator，定向移出 resource scope 的 member list；最终 assert 用 active membership 验证 create 的组织 scope，且验证新的 contract/migration marker。
- [FACT][E-AU-605-003] Finance invoice request/read actions与统一 OperationController 是实际消费者；RegistrationMigrationPlan 将修复列入受控 replay，因此它不是无人使用的补丁文件。

## 未验证项

- 未执行 AU-604→AU-605 的中间状态、member/operator allow/deny、scope rewrite failure 或线上 migration 时序；历史错误是否在真实环境暴露给用户未知。

## 结论等级

- 新增问题：无（历史缺口已由当前链中本 migration 修复）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来 invoice audience 调整应在同一独立 migration 中同时校验 capability audience、resource scope、contract checksum和 member/operator反事实授权。
