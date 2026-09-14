# AU-013 验证结果

- `npm test --workspace @shop/telemetry`：退出127，缺少`vitest`，源码未加载。
- `npm run typecheck --workspace @shop/telemetry`：退出127，缺少`tsc`，源码未加载。
- Redactor合成值探针：Bearer、手机号、email被替换；password label、Cookie、Basic和卡号原样保留；循环对象抛RangeError。
- ClientErrorBuffer合成写入：`message=password=AuditSecretA`经过实际buffer writer后仍原样存在。
- Promise writer探针：指标一次、同一span两次end产生三次`unhandledRejection`。
- Scope探针：错误platform、缺tenant ancestor、跨kind同ID均命中，显式其他tenant拒绝。
- 发布图复算：契约/SDK/模块有两个client-error Operation；专用生产入口无Observability模块，完整ApiMain发布路径被部署检查禁止。

所有探针均使用合成数据和固定源码，没有连接线上、安装依赖或写生产文件。上述命令失败只记录环境事实，不代表产品测试失败。
