# 商城体验初始化任务

`experienceprovision` 消费 `organization.mall.created`，在同一数据库事务中为新商城建立唯一装修应用、首个有效草稿、私有商品池及商城绑定。

## 恢复

任务以 Runtime Inbox 的 `(consumer,event)` 唯一键防重，并对商城获取事务级 advisory lock。失败会整体回滚并按 Job Catalog 退避重试；超过重试上限后进入 `runtime.deadletter`。修复数据或依赖后重放原事件即可，禁止人工直接补写 Experience 或 Catalog 表。

## 核对

确认 `experience.application.mall_id`、`experience.binding.mall_id` 与事件 `mallId` 一致，且该商城只有一个应用和一个有效商品池绑定；随后确认 Inbox 已写入 `processed_at`。
