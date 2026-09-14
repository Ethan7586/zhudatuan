# AU-017｜`@shop/design` Canonical Design System

## 1. 边界

- 固定基线 `5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-16 `21be14fe`。
- 审阅 67/67 文件、4,653/4,653 行：65 个人工文件/4,491 行深入审阅；`Token.ts`、`tokens.css` 两个生成物/162 行核对来源、生成器、变量闭合和消费者。
- 反追 Console 静态/动态 import、Storybook、根质量入口、web/miniapp token 生成器和旧 `@smart-wing/design-system`。
- 不修改组件、CSS、token、测试、配置或生成物；不安装依赖、不打开线上页面、不修复、删除、推送、合并或部署。

## 2. 真实运行边界

[FACT][E-AU-017-002/003] 本包没有独立进程、端口、数据库或发布单元；Console `main.tsx` 直接装载 `tokens.css`、`base.css`、`components.css`、`workspace.css`，并在页面中消费 AccessDenied、Badge、Button、Dialog、Form、ResourceState、Surface、WorkspaceHero 等组件。包代码随 Console 前端制品发布。

[FACT][E-AU-017-004] `components.css` 汇入 foundation/controls/data-display/feedback/VI1.2 foundation，`workspace.css` 再汇入 command。Token 单源是 `tokens.json`；web 生成器写 `tokens.css` 和 `Token.ts`，miniapp 生成器只投影部分色彩/圆角并复制两个 SVG。

## 3. 结论

[CONFLICT][E-AU-017-005] 生产样式引用 80 个仓内无定义的 `--sw-*` 自定义属性。CSS 在变量未定义且无 fallback 时会使对应声明失效；Button 的边框、最小高度、padding、字号，Surface 的边框/背景，以及 WorkspaceHero/MasterDetail 的多项布局和色彩均受影响。Console 同时装载这些消费者和不完整 token 输出，形成 F-0076/P2。

[CONFLICT][E-AU-017-006/007] AccessDenied 生成 11 组 `swaccessdenied*` 类，但全仓 CSS 没有任何定义；测试所谓“dark surface”只断言类名存在。生产 401 又在 Console QueryState 中与 403 一同映射为 `denied`，因此 ResourceState 不进入带重新登录动作的 `unauthenticated` 分支，形成 F-0077–F-0078/P2。

[CONFLICT][E-AU-017-008/009] Storybook preview 未装载 `components.css`，没有正式 story interaction/a11y 执行入口；canonical token 品牌字段为“主打团/ZHUDATUAN/翼码”，但公开 Brand 组件和四个 canonical SVG 仍声明“智慧翼/Smart Wing”。分别形成 F-0079、F-0080/P3。

[CONFLICT][E-AU-017-010] `mobile-platforms.json` 的 iOS/Android 尺寸只被 web 生成器部分读取；wechat、六档 size class、overflow/tablet rules 在固定仓库没有运行/生成消费者，且 miniapp 生成器不读取该文件，形成 F-0081/P3 与 DC-0022/G1。

公共根入口还保留一组无生产消费者的组件/工具，形成 DC-0021/G1；因 public exports、Storybook/测试、仓外消费者和未来迁移未知，均不满足 G2/G3。

本 AU 新增 P2 3 项、P3 3 项、G1 2 项。累计 P0 0、P1 候选 9、P2 40、P3 31、NIT 1；G0 2、G1 18、G2 2、G3 0、GX 1。

## 4. 验证与未知

- package `test`、`test:component`、`typecheck` 各执行一次，均因审计 worktree 未安装 `vitest`/`tsc` 在加载源码前退出 127；不是实现测试失败。
- 两个 JSON 解析通过，四个 SVG 通过 XML 校验；miniapp theme `--check` 返回 0；CP-16 已执行的 canonical web-token `--check` 返回 0。
- 变量集合静态闭合复算发现 80 个 use-without-definition；全仓选择器检索确认零 `swaccessdenied*` CSS 定义。
- [UNKNOWN] 固定基线真实 Console 页面在浏览器 computed style 下的可见损失范围；[UNKNOWN] 仓外消费者是否使用未消费公共 export；[UNKNOWN] `mobile-platforms.json` 未接线部分是待实现规格还是退役文本。

