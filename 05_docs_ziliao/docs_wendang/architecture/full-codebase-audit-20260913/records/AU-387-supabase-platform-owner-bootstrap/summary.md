# AU-387｜Supabase 平台 Owner 初始化

`20260817191000_bootstrap_ethan_platform_owner.sql` 是一次性、显式身份引导迁移：它仅在 active 本地用户名 `ethan`、active platform_owner 角色、商城上下文和既有 platform scope 都存在时执行。它不会读取或修改密码，也不会从 UI/RPC 接受 Owner 身份。迁移在单一事务内创建固定 Owner membership、授予平台/租户范围并记录审计事实；两项 Owner 保护触发器只在对应写入期间暂时禁用，任意失败会整体回滚。

后续 `20260820132000_platform_owner_reconciliation.sql` 将其收敛为唯一 active platform Owner、补足组织范围并停用测试身份；后续运行契约、数据迁移和测试仍以该 membership ID 作为历史锚点。固定 Owner 常量属于明确的环境 bootstrap/迁移兼容责任，不能按普通“硬编码身份”当成垃圾删除。

归 G0；未发现新增 P0–P3 或删除候选。未执行身份变更、数据库迁移、登录或线上检查。
