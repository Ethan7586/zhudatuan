# AU-802｜MockPool catalog 编译器

- 审阅范围：`compile-mockpool-catalog.mjs`（155 行）与唯一单测（38 行）。
- 审阅方式：审阅 source/row 校验、分类映射、确定性摘要和显式 CLI 写入路径；执行纯函数 test，未给 CLI 传输出路径。

## 审计结论

- **F-0314 / P3：** source 只要求 `items` 是数组，允许空数组；随后 `Math.min(...[])`/`Math.max(...[])` 产生非有限值，`JSON.stringify` 将其投影为 `null`，同时 document validation 仍为 `passed`。唯一测试只覆盖100个有效 item，未锁定空集、无效 item 或重复 SKU 的摘要语义。
- 编译器无根 package/workflow 自动入口；但其把模拟货盘转换为明确标记 `isMock`、`draft` 的 catalog package，并有可观察 CLI 输出，故为 **G1**，非删除候选。
- 测试 1/1 通过，仅证明有效100行 fixture 的 deterministic draft 投影，不能证明生产 catalog 导入或真实图片可用。
