# AU-380｜Supabase 动态会员码

`20260815160000_dynamic_member_code.sql` 保存的只是随机凭据的 SHA-256 hash；明文只随短期二维码载荷返回。签发前锁定 Storefront membership，核验会员、用户、手机号认证和 authz version；刷新会撤销此前 active challenge，凭据有效期 45 秒。撤销和核验均在数据库按 challenge 行锁原子执行，已消费、过期、权限版本变化和身份失效均不能复用。

实际运行入口已核实：Storefront router 注册签发与撤销，admin router 注册核验；核验 HTTP handler 先判定 `member_code.verify`，再把管理员 membership 和用户 ID 传入同商城范围的数据库核验。数据库函数本身仅授权 service role，未向浏览器数据库角色开放。

三条 RPC 仍是当前 API 的直接契约，归 G0。未发现新增 P0–P3 或删除候选；未执行二维码签发、权限变更、测试或数据库写入。
