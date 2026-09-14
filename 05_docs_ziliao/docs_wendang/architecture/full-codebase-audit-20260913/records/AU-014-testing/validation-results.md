# AU-014 验证结果

- 正式`npm test --workspace @shop/testing`：缺`vitest`，退出127，源码未加载。
- 正式`npm run typecheck --workspace @shop/testing`：缺`tsc`，退出127，源码未加载。
- DatabaseHarness双异常探针：主测试`TEST_FAIL`被reset的`RESET_FAIL`覆盖。
- HttpHarness异步变更探针：冻结captured为旧URL/header，responder读取到修改后的新URL/header。
- TestIdGenerator沿用AU-009真实Kernel parser反事实：sequence 18产生禁字`I`并抛`ID_INVALID`。
- 没有连接测试数据库、安装依赖、运行全量测试或修改任何测试/生产文件。
