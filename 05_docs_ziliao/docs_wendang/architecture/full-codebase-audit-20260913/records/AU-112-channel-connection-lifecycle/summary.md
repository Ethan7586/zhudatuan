# AU-112｜Channel connection 生命周期与同步 Worker 深审

本审计点覆盖 connection 创建、配置、测试、启用、停用，sync run 创建/取消、runtime job 投递，以及 Catalog、Price、Stock、Statement 四类同步 Worker。

入口由 `channelRoutes` 组装；`registerJobs` 注册四种 Worker。连接和同步均以当前 access scope 作为数据边界，connection enable 使用行锁、状态机与版本更新。同步 run 只可针对 enabled connection 创建；Worker 以 provider extension 拉取并在 transaction 内投影数据、写 outbox 或续页 job。

发现：F-0166/P2，cancel 与在途 Worker finish 存在终态覆盖竞态；F-0167/P2，模块仅有 manifest 静态测试。未发现 P0/P1。未执行测试：工作区未安装 Vitest；本审计不安装依赖或修改代码。
