# AU-105｜Identity 手机、WeChat 与 Step-Up 操作深审

手机变更以当前 realm account 与手机号 hash advisory lock 串行化。首次录入必须有本 session 的近期 password evidence；已验证手机号替换必须通过 level-3 step-up。完成后更新 password credential subject、profile/account mobile、phone assurance，并撤销全部关联 session；精确 Owner 使用受控数据库边界。

Step-Up 禁止调用方指定 destination，只解密当前 account 已验证手机号，并把 challenge 绑定到 actor、session、realm 与 account。完成后创建 session-level assurance；可选 WeChat bind 在 phone challenge 消费之后完成。金融 proof 只接受声明的敏感 operation，并重新计算 canonical request hash、绑定 idempotency/expected version/assurance。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行；关键测试已在 AU-103/104 人工审阅。
