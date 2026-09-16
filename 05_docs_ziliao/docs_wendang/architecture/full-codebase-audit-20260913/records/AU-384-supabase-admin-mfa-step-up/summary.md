# AU-384｜Supabase 管理员 MFA 二次验证

`20260817113000_admin_mfa_step_up.sql` 建立 TOTP factor、五分钟 challenge、单会话串行化、失败锁定、完成审计和 service-role RPC。密钥仅以密文保存；浏览器数据库角色没有表或函数权限。后续授权闭环迁移还把其身份校验替换为锁定 membership actor 谓词。

但当前 `commerce-api` 的实际二次验证路由使用本地密码或测试账户密码、`api_record_step_up` 和会话替换；全仓未找到它对这组 TOTP start/material/failure/complete RPC 的运行调用。数据库契约测试仍调用 start RPC，证明其不是无定义对象，但不能证明生产接线。

因此原 TOTP factor/challenge 表和四个交互 RPC 列为 G1、禁止删除；需要专项确认正式管理员 MFA 产品入口、密钥运维与历史部署后才能决定是否接线或退役。现行密码 step-up 的登录限流与锁定行为为既有 F-0235，本单元仅复核，未新增 P0–P3。未执行 MFA、登录、测试、数据库写入或线上检查。
