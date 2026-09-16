# AU-013｜`@shop/telemetry` 遥测内核

## 1. 唯一目的与边界

本单元只审固定基线中 `@shop/telemetry` 的18个文件，以及日志、指标、trace、客户端错误和交互时间线的第一层真实消费者。不展开各业务模块，也不改变任何运行状态。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 开工检查点：CP-12 `dcdfc5d0`。
- 纳入：18文件/473行；14个生产源码、3个测试源码、package与tsconfig；27个包引用文件、6个直接测试。
- 排除：线上日志内容、真实用户数据、修复、删除、依赖安装、全量构建、推送、合并和部署。

## 2. 结论

[FACT][E-AU-013-002] 18/18文件、473/473行完成逐文件、逐函数、逐失败分支审阅。包本身不拥有进程、端口或数据库；`nodeTelemetry`随多个Commerce运行进程写标准输出，`createInteractionTimeline`进入Auth、Console和Storefront，客户端错误缓冲由Observability模块封装。

[CONFLICT][E-AU-013-004/005] `Redactor`只根据对象键和少数字符串模式脱敏。合成但无真实凭据的探针确认任意字符串中的`password=...`、Cookie、Basic认证串和卡号原样保留，身份证只被手机号规则局部替换。相同脱敏器位于生产Operation审计持久化链和日志链，形成F-0065/P1候选；没有读取线上日志或证明已经发生泄露，因此不是P0。

[CONFLICT][E-AU-013-006] 两个`observability.clienterrors.*`操作保留正式契约、能力目录、SDK和模块实现，但固定发布只允许专用入口；唯一装载完整`COMMERCE_MODULES`的`ApiMain`属于被部署检查明确禁止的`commerce-api`/`ApiMain.js`路径，专用入口没有Observability模块，形成F-0066/P2。

[CONFLICT][E-AU-013-007] writer契约允许返回Promise，但指标、trace和客户端错误均用`void`丢弃返回值。拒绝型writer探针产生未处理Promise rejection；当前生产stdout writer同步，故记录为F-0067/P3。

[CONFLICT][E-AU-013-008] ClientErrorBuffer复制了一套Scope containment，异常platform、缺tenant层级grant及跨kind同ID均可命中，补强既有F-0055/P2。正式AccessPipeline通常提供规范scope，且该操作当前不在正式生产入口，未上调等级。

本AU新增P1候选1项、P2 1项、P3 1项；补强既有P2 1项；新增G1 2项。累计P0 0、P1候选9、P2 37、P3 20、NIT 1；G0 2、G1 14、G2 1、G3 0、GX 1。

## 3. 值得保留

- `Telemetry`把logger、metrics、tracer和client-error协议统一到一个writer边界，运行进程可选择同步stdout或平台适配器。
- `ClientErrorBuffer`按稳定fingerprint聚合重复错误，并在写入前用服务器派生Scope替换客户端scope。
- `InteractionTimeline`用单调时钟和零下限记录阶段耗时，三类前端共享同一事件结构。
- 测试直接加载实现而非复制算法，能覆盖重复错误聚合、retention清理、交互阶段和基本脱敏主干。

## 4. 验证与未知

- 正式package test与typecheck各执行一次，均因审计worktree缺少`vitest`/`tsc`在源码加载前退出127；未安装依赖，也未写成实现失败。
- 只读合成探针验证脱敏遗漏、循环对象RangeError、异步writer拒绝、Scope异常输入和timeline回调异常状态。
- [UNKNOWN] 线上日志/Operation审计是否已经包含此类敏感字符串；本AU没有连接线上或读取真实内容。
- [UNKNOWN] 仓外客户端是否直接依赖browser/miniapp/tracer公共入口，或仓外部署是否仍运行完整ApiMain。

## 5. 检查点纪律

本单元只写审计报告和覆盖清单；没有修改生产代码、测试、配置、迁移、依赖、锁文件或生成物，没有连接线上、推送、合并或部署。
