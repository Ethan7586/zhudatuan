# AU-002｜入口与页面历史证据

## 1. Auth owner-approved 漂移

- `owner-approved-ui.json` 最近一次变更为 `9d945bb8`（2026-09-10）；`App.tsx`、`index.html` 与 `site.webmanifest` 随后在 `3ea66a36`（2026-09-11）发生品牌/受众切换相关变更。
- 当前 `LoginPage.tsx` 仍匹配锁定 SHA，但 App 从仓库基线起已通过 ConsumerIdentityPage/OperatorIdentityPage 分流；当前生产源码没有对 LoginPage 的 import。
- `SOURCE-MANIFEST.md:23` 仍写 App → LoginPage；因此它是 [STALE] 线索，不是当前运行证据。
- 历史顺序能解释哈希何时漂移，不能决定批准 UI 应以哪一版为准；该产品决定必须由 Ethan 裁定。

## 2. Auth response Schema 回归点

- `7d94f2aa`（2026-09-12，提交主题“冻结旧身份响应与请求版本裁决”）把九处 `Schema.parse(await request(...))` 改为先请求，再 `void Schema.safeParse(response)`，随后 `response as z.infer<...>`。
- 该 diff 是最小行为反事实：原实现会使用解析结果并在无效输入抛错，当前实现既不读取 `success`，也不使用 `data/error`。
- 本审计不猜测提交者意图，也不回退该提交；只记录可观察语义变化。

## 3. 前端机器证据漂移

- `04_tools/scripts/check/frontend.mjs` 最近一次变化为 `035d7acf`（2026-09-05）；此后 Console/Storefront 增加了当前未列入 knownDebt 的样式。
- `05_docs_ziliao/docs_wendang/evidence/frontend/files.json` 最近一次变化为 `5a0c6636`（2026-09-07）；固定基线在此后继续新增/删除/修改前端文件。
- 两项正式 check 都会失败，说明这些文件不是“历史快照仅供参考”，而仍被 canonical-hard-cut 当作当前机器证据。

## 4. Miniapp 历史边界

- 当前 Git 全历史中未找到 `01_core_hexin/apps/miniapp/miniprogram/app.json`、`api/client.js` 或 `navigation/actions.js` 的对象记录。
- `01_core_hexin/apps/wechat-miniapp` 在当前树和可检索 Git 对象中均不存在，但 delivery matrix 自初始基线起引用该路径；`regression.mjs` 同时明确把该目录列为 retired。
- 这只证明当前仓库历史不能重建完整 Miniapp，不证明外部私有工程不存在、产品已下线或当前 9 文件可删除。

## 5. CSS 历史/替代责任

无文件名消费者的 CSS 中，部分选择器仍由现存组件使用，部分组件只在测试或未挂载子图中出现，另有 `MemberAccessWorkspace` 已改导入新的样式组合。历史和替代关系没有完成第二轮视觉复核，因此本 AU 不产生垃圾代码候选。
