# RV0057｜GX-0035 Console member manage 与 password assurance

- 复核对象：`20260821072000_add_console_member_commands.sql` 及其当前 Console、identity、统一操作执行器调用链。
- 直接证据：迁移同时登记 `identity.members.manage`/`identity.password.verify` 的 HTTP 操作、能力、平台 Owner 的 `member.manage` 权限及封板断言；Console access 清单、identity 模块清单和操作目录测试均保留两个入口。
- 运行链：Console 请求经操作目录进入 identity；成员管理对目标成员行加锁，受 `access.scope_allowed` 与权威治理解析限制，离岗会失效角色、范围、override 与关联邀请，并撤销其会话；统一执行器以事务、幂等记录和操作审计包裹写操作。
- assurance 证据：密码成功验证后，仅为当前未撤销 session 写入 level-2 password assurance（证据为 session digest，10 分钟过期）并提升 session level；现有测试覆盖该 session 绑定及后续敏感移动号流程对新鲜 assurance 的要求。
- 结论：GX-0035 不是闲置后台命令或重复 SQL，而是高权限成员生命周期与敏感操作 step-up 的发布契约；维持 GX，禁止删除。未发现 P0/P1；未执行测试或线上操作。
