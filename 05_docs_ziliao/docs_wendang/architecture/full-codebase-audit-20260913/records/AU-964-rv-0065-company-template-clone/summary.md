# RV0065｜GX-0045 公司模板克隆

- 静态复核确认：函数以 `zhudatuanwebapi` execute 权限创建组织、Realm/node、目标 membership、scope、catalog/experience 配置和 pending binding；不复制业务历史、会话或凭据。
- 现有定向夹具覆盖回滚、幂等和跨 Realm 隔离，但不能替代真实角色/RLS 的 direct invocation 验证。
- 结论：维持 GX；不得删除、简化或单独执行。后续须在授权隔离 PostgreSQL 以真实角色验证同源 allow、错配 deny、空 session deny 与恢复矩阵。未发现 P0。
