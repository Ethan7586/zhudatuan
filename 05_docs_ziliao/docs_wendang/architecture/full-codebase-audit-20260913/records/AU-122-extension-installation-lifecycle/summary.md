# AU-122｜Extension 安装、配置与启停生命周期深审

安装先验证 manifest、签名、hash、host contract、secret/configuration；测试/启用以 candidate health 与 installation version 控制，原子替换数据库状态后才激活 loader。停用也在 transaction 后才卸载 loader。

未发现 P0/P1。命令生命周期没有行为测试，记录为 F-0171/P2；未运行 Vitest。
