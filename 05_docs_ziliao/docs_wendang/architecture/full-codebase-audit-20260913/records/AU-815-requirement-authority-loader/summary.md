# AU-815｜Requirement Authority 加载器

- 审阅范围：`requirementgen/src/Authority.ts`（约100行）；证据来自AU-814的调用/测试审阅。
- 结论：加载器先realpath root与authorities配置，拒绝绝对/空/`..` authority路径；对candidate和resolved target均作仓内判定；读取后强制SHA-256与声明相符，并校验version、sheet计数、字符串字段。**G0**，无新 finding。
- 测试运行仍受当前worktree缺少Vitest阻塞；源码反例规格见AU-814。
