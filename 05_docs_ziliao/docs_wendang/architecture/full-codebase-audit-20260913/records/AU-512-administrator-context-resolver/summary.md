# AU-512｜AdministratorContextResolver 实现

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/AdministratorContextResolver.ts`（86 行）；结合 AU-511 逐段阅读，定向检索数据库函数定义/授权迁移与应用调用。
- 审阅方式：人工实现审阅与静态引用追踪；未执行迁移或数据库函数。

## 审计结论

- **G0**：resolver 只接受 console、已认证 account/realm actor，并将 SQL 返回的 membership、account、principal、realm、access version 与 session projection 对比。它不信任 caller 传入的管理员角色或 scope。
- 解析器将 role/permissions 和 segment scope 复制后冻结；scope schema version 来源于 node kernel 常量，numeric version/time 均 fail-fast 规范化。该边界被 AdministratorSegmentOperations 的 list/detail/write 复用。
- 数据库函数有专用 migration 定义，并由显式 revoke/grant 控制；本单元不把 SQL migration 的复杂性或 resolver 的单行查询认定为垃圾。

## 未验证项

- SQL function 的 role assignment、segment 可见性、RLS 与 grant 在真实数据库的行为没有执行验证；必须在其迁移审计单元中独立确认。
