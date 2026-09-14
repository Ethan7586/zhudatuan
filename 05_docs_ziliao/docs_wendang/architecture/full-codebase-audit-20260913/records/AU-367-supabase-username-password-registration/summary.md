# AU-367｜Supabase 用户名密码注册

`20260812250000_username_password_registration.sql` 为无手机号的用户名/密码注册建立唯一用户名别名和 storefront 员工邀请事务。输入、口令哈希长度、用户名格式、条款版本、邀请有效期/次数/企业归属和普通 employee 角色均在数据库验证；成功路径原子写入用户、成员、用户名别名、凭据、storefront membership、self 范围、福利账户和审计日志。当前注册路由在生产环境仍受独立开关控制，且通过 service-role 调用该 RPC。

本轮独立复查再次确认 F-0234（P2）：按 IP hash 的 `username_registration_attempts` 在一小时窗口累计超过十次后设置一小时 `blocked_until`，路由预检与注册结果均会返回 429。该行为和项目既定的“不保留注册/登录失败限流、锁定或冷却”规则冲突；未发现 P0。

结论为 G0：用户名身份、员工邀请和审计记录职责；F-0234 维持原等级并已由多条注册链路独立重查。未执行注册、测试或数据库写入。
