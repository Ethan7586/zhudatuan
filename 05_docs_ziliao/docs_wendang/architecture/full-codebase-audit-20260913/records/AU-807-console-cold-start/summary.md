# AU-807｜Console cold-start 性能脚本

- 审阅范围：`perf/console-cold-start.mjs`（580 行）。
- 结论：脚本用显式 baseline/candidate dist 启动 loopback HTTP server、Playwright Chromium和合成 Owner API，测量前端 artifact；未运行，避免启动进程、读取制品或可选写 JSON/CPU profile。
- **F-0315/P3：** targets 在 `try/finally`前顺序初始化；baseline `serve()`已成功而candidate `target()`失败时，baseline server不在finally管理，可能留下本地监听器。合成API亦使性能结果不能证明真实后端/授权行为。
- 无根自动入口但保留人工性能验收职责，**G1/DC-0091**。
