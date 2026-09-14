# AU-087｜WebBusiness Member 读取、地址与 Mall Lifecycle 运行入口深审

Web selected Member module 提供 profile、mall open、sovereignty upgrade、address read/manage。profile/address 先调用 `access.web_member_context(membership,session)`；数据库函数再次核验 invoker role、session-member pair、active principal、credential/access version 和过期/撤销状态，只返回最小 member projection。

地址保存前会用 KMS 对收件人、手机号和详细地址形成 principal-bound envelope；delete/default 分支不加密且由 AddressPort 按 member/version 操作。Hosted mall opening 和 sovereign upgrade 复用 canonical action：将 access node context 和 idempotency key 传给 MemberPort；现有 MemberPort 测试确认 SQL 只传 active membership/node。

未见 P0–P3 新问题；未运行 Vitest、未写生产代码或改变运行状态。
