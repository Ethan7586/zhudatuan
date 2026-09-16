# AU-096｜Identity realm/account 与 SMS 登录数据库边界深审

RealmAccount 从 active realm entry 和 target registry 解析 host、surface、application 与 membership 目标。active membership context 优先调用数据库 resolver，在未安装时才读取可检测的旧投影。

SmsLogin 的账号和 password credential 查询均限制于可包含 account realm、活动账号以及请求的 client/organization membership；不同 principal 的同一手机号拒绝。SMS code 在 challenge lock 下验证 purpose、destination、realm、expiry 与未消费状态，随后以条件更新消费。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
