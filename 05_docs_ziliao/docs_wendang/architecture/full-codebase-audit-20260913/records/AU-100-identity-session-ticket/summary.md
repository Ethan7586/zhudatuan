# AU-100｜Identity HTTP 会话票据与安全辅助链路深审

SessionTicketOperations 处理 password/SMS 登录、active realm membership、session/assurance 创建、跨节点 intent 消费、AuthTicket 回跳和会话管理。所有 session 查询与修改均定位到当前 active account/realm；跨节点 intent 必须从认证 source node 发起，目标 host 由数据库受控函数返回。

发现 F-0163/P3：consumeChallenge 对过期 challenge 的主消费有 expiry 约束，但失败记数更新漏掉该约束，错误 code 可继续递增过期记录 attempts。

结论：未发现 P0–P2 新问题。Vitest 未安装，未执行。
