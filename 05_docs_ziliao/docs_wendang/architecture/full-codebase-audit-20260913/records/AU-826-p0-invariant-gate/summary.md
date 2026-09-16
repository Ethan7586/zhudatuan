# AU-826｜P0 不变量静态门禁与 Console 方案预览

- 审阅范围：`verify-p0.mjs`、source collector、Console 方案预览关键路径与 `public/demo/variants.js`。
- 正式 `npm run check:p0` 失败：`P0_PRODUCTION_SUBSTITUTE:.../public/demo/variants.js`。失败已记录，未修复。
- 深读结果：demo 脚本只做 DOM、样式、localStorage 和提示文本；没有 API、身份、支付或数据写入。其被 `variants.html` 使用，Console 通过独立 `VITE_ZHUDIAN_SOLUTION_ORIGIN` iframe 预览；未配置时生产环境明确拒绝同源载入。批准 UI 清单还固定了 demo 文件的 SHA。
- 裁定：非线上 P0，新增 **F-0318/P2**。问题是 P0 静态门禁只按路径名把受批准预览误判为生产替代，使正式 P0 gate 固定失败、丧失发布判别力。`check:frontend` 对同一资产已有 known-debt 语义，但本次运行显示另有 13 个 CSS token 失败，作为未扩展审计的环境证据保留。
