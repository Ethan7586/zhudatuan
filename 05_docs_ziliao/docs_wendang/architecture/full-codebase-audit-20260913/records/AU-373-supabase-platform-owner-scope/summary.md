# AU-373｜Supabase 平台 Owner 范围

`20260813040000_platform_owner_scope.sql` 收紧 platform scope：只有具备 active Owner 角色的 active admin membership 才能绑定 active 平台组织节点。迁移同时为所有现有满足条件的 Owner membership 回填真实平台范围，普通 membership 无法写入 platform binding。

该校验是组织层级、范围委派与权限运行时投影的前置约束；当前 API 对 platform scope 的反序列化与范围决策仍接受数据库导出的该范围。结论为 G0，不能仅因它是一次回填就判断为可删迁移。

未发现新增 P0–P3 或删除候选；未执行权限变更、测试或数据库写入。
