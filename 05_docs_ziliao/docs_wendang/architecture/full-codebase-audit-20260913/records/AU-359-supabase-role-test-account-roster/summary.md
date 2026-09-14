# AU-359｜Supabase 角色测试账号名册

`20260812130000_role_test_account_roster.sql` 幂等建立 25 个买家、商家、运营、客服和企业管理员测试身份，并写入其角色、成员资格、范围、旧 `user_roles` 投影、登录别名以及买家隔离的钱包/积分钱包。当前 Commerce API 的 demo 认证通过相同 Member → Membership → Role → Scope 运行时解析这些记录；因此名册不是孤立样例数据，也不是零引用的迁移残留。

固定演示口令只在 `APP_ENV/AUTH_MODE` 精确匹配 development/development 或 test/test 时进入候选集合。基线内各生产运行单元均声明 `APP_ENV=production`、`AUTH_MODE=membership`；以此静态部署证据，生产路径不会加载这些账号。未连接线上或本地数据库，不能将部署配置当作实际运行状态证明。

结论为 G0：测试、验收与本地演示的身份—权限契约职责。未发现新增 P0–P3 或删除候选；未执行测试、登录或任何数据库写入。
