# AU-371｜Supabase 自定义角色与完整范围

`20260813030000_custom_role_center_and_full_scopes.sql` 建立自定义角色生命周期、角色状态、完整范围校验和权限委派上限。角色创建/编辑/停用禁止 Owner 与系统角色变异，并限制被委派管理员只能配置其当前有效且未被显式 deny 的权限；范围授权由 `api_actor_can_grant_scope` 与 membership scope 触发器双重验证。权限中心与自定义角色中心分别返回经服务器计算的可管理成员、角色、权限和范围选项。

当前 admin router 注册自定义角色读取、创建、编辑与状态变更路由；这些路径都通过 service-role RPC。后续 canonical distributor 与 anchor 迁移重定义范围/公开入口，但保留本文件的角色数据、Owner 不变量、委派上限和历史迁移重放责任。

结论为 G0：角色生命周期和范围委派授权基础职责。未发现新增 P0–P3 或删除候选；未执行角色或范围变更、测试或数据库写入。
