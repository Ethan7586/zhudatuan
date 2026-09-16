# AU-531｜Mall provisioning PostgreSQL 引擎测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/MallProvisioningEngine.test.ts`（417 行）；定向追踪 MallProvisioning API runtime/bootstrap、CreateMall、PgUnitOfWork 与 cleanup。
- 审阅方式：逐关键路径人工阅读；测试需要 admin/runtime PostgreSQL endpoint，本轮未执行。

## 真实运行关系

L0 owner console request → bootstrapped MallProvisioningModule/API → CreateMall plan/UnitOfWork → organization/mall owner/membership/role/pool/application/version/binding/idempotency facts → ready read。测试重复和并发调用相同 key，注入不可用 owner membership 验证 rollback，并由 admin DB 查询精确事实/cleanup。

## 审计结论

- **G0**：这是真实 DB+HTTP composition/integration test，覆盖 L1 mall core 的所有权、独立 catalog/experience resources、idempotency replay、失败回滚和 cleanup baseline，不是单纯 fixture。不得删除。
- 测试把 pipeline authorizer 替换为固定 owner access，因而验证 provisioning workflow/DB，不验证 production bearer、permission/risk/step-up 策略；该边界应由身份/API测试补足。

## 未验证项

- 未运行 endpoint-gated test；真实 role/RLS、release/node resource provisioning、external deployment、cleanup in failure cases及生产并发未验证。
