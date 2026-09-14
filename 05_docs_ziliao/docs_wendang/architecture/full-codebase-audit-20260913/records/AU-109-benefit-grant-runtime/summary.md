# AU-109｜Benefit 发放、使用、撤销与任务链深审

Benefit API 以 scope、state、version 和四眼原则管理 plan/budget/grant。批准前 reserve budget；grant worker 以 item locking 创建 benefit account/lot、调用 finance posting、迁移 reserved/granted，并写 outbox。revoke 按 pending/active lot 分支释放或回收余额；expiry 激活到期 lot、提醒、过期与余额扣减。Checkout gateway 的 reserve/consume/refund/release 均以 account、reservation 和 lot lock 实现。

发现 F-0165/P2：仅有 GrantPolicy 与 manifest 静态测试，API/worker/资金状态转换均无行为测试。Vitest 未安装，未执行。
