# AU-008 定向验证结果

| 验证入口 | 退出 | 结果分类 | 可证明 | 不可证明 |
| --- | ---: | --- | --- | --- |
| `npm run check:runtimegraph` | 1 | 环境阻塞 | `source.mjs` 导入 `typescript` 时失败，checker 逻辑未开始 | 不能写成 runtimegraph 通过或逻辑执行失败 |
| `npm test --workspace @shop/sdk` | 127 | 环境阻塞 | `vitest` 不存在，0 个用例加载 | 不能证明 27 个测试通过/失败 |
| `npm run typecheck --workspace @shop/sdk` | 127 | 环境阻塞 | `tsc` 不存在，0 个源码完成类型检查 | 不能证明固定基线类型检查通过 |
| `node 04_tools/scripts/build-miniapp-contract.mjs --check` | 1 | 环境阻塞 | 导入 `DeepLinkContract.ts` 时缺 `zod`，比较逻辑未开始 | 不能证明 tracked Miniapp 输出通过正式 check |
| 只读生成目录复算 | 0 | 通过 | OpenAPI 345、runtime 271、frozen 74；SDK/Controller/Handler/current.sql 缺项均为 0；Event registry 67/67 | 不证明 handler 业务正确或线上版本 |
| runtimegraph required-token 逐项复算 | 0（复算脚本） | 发现冲突 | ApiClient token缺失、Miniapp client文件缺失、HttpApp两个 token缺失 | 不替代正式 checker 的其它 callgraph 规则 |
| ECMAScript 序列化反例 | 0 | 通过 | `JSON.stringify(undefined)` 的结果类型为 `undefined`，与 `TransportResponse.body: string` 冲突 | 不证明微信线上实际返回 undefined |

本 AU 没有安装依赖、没有运行生成写模式、没有启动服务、没有访问数据库或线上资源、没有运行全量 build/test。
