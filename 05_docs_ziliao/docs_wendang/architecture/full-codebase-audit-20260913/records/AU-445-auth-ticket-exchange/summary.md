# AU-445｜认证票据交换

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821035000_add_auth_ticket_exchange.sql`（49 行）。
- 交叉核对：Identity ticket repository/operation、并发与登录稳定性测试、部署契约检查，以及后续 realm/account/target 绑定迁移。
- 本批为静态身份链路审阅；未运行登录、数据库、测试或线上操作。

## 运行结论

`identity.authticket` 将会话绑定到唯一 token/state/nonce 哈希、PKCE challenge、返回目标、过期与消费时间；未消费票据具备过期索引，外键级联删除避免会话失效后残留。Identity repository 以条件更新消费票据，operation catalog、SDK、HTTP 路由和测试均消费 `identity.tickets.exchange` 公开接口。

后续 realm/account 迁移为票据补充身份域和 active account 约束，并规范化 target；这表明初始 ticket 表是当前多端身份边界的基础而非历史残留。

## 审计结论

- G0：认证票据交换基础模型和公开 operation 登记，不是删除候选。
- token/nonce/state 不复用、PKCE 验证、并发单次消费与跨 realm 隔离已有静态实现/测试线索，但本批未实际运行验证。
- 本批未新增 P0–P3。
