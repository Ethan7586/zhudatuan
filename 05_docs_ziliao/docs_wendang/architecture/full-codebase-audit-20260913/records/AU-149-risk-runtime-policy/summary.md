# AU-149｜Risk 策略、评估、HTTP 与 Worker 运行链深审

Risk adapter 在 scoped API transaction 中评估 hierarchy policy、signals、velocity 与 block list。Policy 保存产生 candidate/replay/job，只有回放通过且与创建者分离才可 activate。`riskscan` 负责 policy replay，也消费 catalog deny decision 并调用 Catalog action。

新增 F-0180/P2：当前测试不直接覆盖 repository/adapter/HTTP/worker 组合。未发现 P0。
