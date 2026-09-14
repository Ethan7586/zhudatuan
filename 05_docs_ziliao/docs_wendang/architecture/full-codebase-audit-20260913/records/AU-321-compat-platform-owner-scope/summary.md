# AU-321｜Compatibility 平台 Owner 范围

该前向迁移收紧 platform scope：只有仍持有活动 Owner 角色的活动管理员 membership 能绑定活动平台组织节点，普通 membership 不能创建该全局范围。迁移同时为现有活动 Owner 补齐实际平台组织绑定；其余 distributor 至 self 的范围验证沿用 AU-319 的组织图归属检查。

平台 Owner 的全权限由既有受保护系统角色提供，而平台 scope 仅用于运行时范围解析和范围投影；本迁移不新增浏览器数据面或外部调用。审计工作树未运行测试。

未发现新增 P0–P3 问题或删除候选；文件保留现有 Owner 范围前向校正职责，结论为 G0。
