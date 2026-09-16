# AU-810｜Console 制品读取与完整性校验

- 审阅范围：`release/console-artifact.mjs`（43 行）及 build/verify/perf 调用者。
- 结论：读取前要求index、Vite manifest、build evidence存在；schema parser校验manifest，可锁定source SHA与clean source tree；随后对排除证据文件的不可变摘要校验，并返回全目录hash。纯读取，**G0**，无新 finding。
- 边界：未提供dist或运行build/verify；不因此证明任何实际Console制品可用或已发布。
