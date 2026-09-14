# AU-089｜WebBusiness Benefit 账户与账本读取运行入口深审

WebBusiness 对 member 只暴露 `benefit.accounts.read` 和 `benefit.ledgers.read`。两个 operation 将 active membership 与 session 传入 `benefit.web_account_balance` / `benefit.web_ledger`，再对结果作 keyset 分页；账户响应可附带 pending/active lot。

两个数据库函数均为 SECURITY DEFINER 且仅授予 `zhudatuanwebapi` 执行；它们先核验 session、credential/access version、active principal/profile/membership 和 member 的 organization scope，才跨 benefit/finance 读取。相较完整 Benefit module 的直接 shopapp 表读，这保持了 Web role 的最小 Finance 边界。

未见 P0–P3；未运行 Vitest、未变更任何运行状态。
