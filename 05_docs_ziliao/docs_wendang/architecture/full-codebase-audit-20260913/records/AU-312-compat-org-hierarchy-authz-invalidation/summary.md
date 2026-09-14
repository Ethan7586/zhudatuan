# AU-312｜Compatibility 组织层级与授权失效

该迁移建立平台、租户、企业、商城和部门的组织树及闭包表。父节点类型、跨租户关系和环均在触发器内验证；层级变更以事务 advisory lock 串行化，并由 statement trigger 重建闭包表。初始数据从现有 tenants、enterprises、malls 和 departments 映射而来，嵌套部门在完整映射后再调整父边。

订单、售后和商品授权范围 RPC 保持既有 tenant/enterprise/mall/supplier 平面字段，同时加入数据库生成的 root-to-resource `org_unit_path`，供纯授权库匹配层级 scope；客户端不能提供该路径。角色权限表变化会递增所有仍持有该角色的 membership `authz_version`，使旧会话在下一次运行时解析时失效。组织表与路径 RPC 都仅对 service role 开放。

未发现新增 P0–P3 问题。因审计工作树缺少 Vitest 依赖，未执行测试；`membershipContext.test.ts` 已覆盖数据库路径到受信资源范围的解析边界。
