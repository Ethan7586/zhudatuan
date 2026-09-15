# AU-812｜Console release build 编排

- 审阅范围：`release/build-console.mjs`（56 行）及根 build script/workflow调用点。
- 结论：要求输出目录不存在且不在worktree，构建前后检查完整git clean状态，固定40位HEAD SHA/production客户端版本，核验worktree dist后复制、浏览器验证并复验外部输出。它写dist/外部artifact并启动验证浏览器，未运行。
- 构建路径是人工release编排职责，**GX**；无新的静态 finding。现有用户审计队列dirty文件会令其fail-closed，符合其release隔离约束。
