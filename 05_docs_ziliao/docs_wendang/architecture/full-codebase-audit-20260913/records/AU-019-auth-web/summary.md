# AU-019｜Auth Web 身份入口链

## 1. 边界与覆盖

- 固定源码基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-18 `0435ae8f`。
- 覆盖 `01_core_hexin/apps/auth-web` 58/58 文件、6,807/6,807 行：49个人工文本/代码文件6,583行深入审阅，9个品牌二进制/SVG资源224行结构性审阅。
- 从 `index.html → main.tsx → App.tsx` 反向核对域名/查询参数分流、runtime registry、消费者/运营者页面、session/ticket exchange、注册、找回密码、样式、资产、测试和发布入口。
- 没有安装依赖、构建制品、打开线上页面、读取线上配置、修复、删除、推送、合并或部署。

## 2. 真实架构

[FACT][E-AU-019-002/003] Auth Web没有前端路由框架。`main.tsx`先按构建注册表尝试渲染，再异步读取同源`/identity-runtime.json`；`App`按当前accounts hostname以及`application/target/client/admin_origin/surface`分为Consumer、Operator或invalid页。

[FACT][E-AU-019-004] 当前生产源码入口只挂载`ConsumerIdentityPage`和`OperatorIdentityPage`。两页通过canonical identity/registration服务向节点`apiOrigin`或`consumerApiOrigin`发请求，创建session后交换一次性ticket，再仅接受当前节点声明的console/storefront回跳origin。

[CONFLICT][E-AU-019-008] `LoginPage`与`auth.ts`组成另一套兼容登录、表单POST、客户端锁定、注册和未接通step-up流程，但当前App无import；owner-approved机器清单仍锁定LoginPage。列GX-0002，禁止按零引用删除或擅自重新挂载。

## 3. 主要结论

- [P1-CANDIDATE][E-AU-019-005] runtime文件只校验字段形状和当前accounts host，不把API/console/storefront origins绑定到受信Manifest或已校验digest；仓内测试明确接受任意HTTPS `.invalid` origins。安装后登录服务会把账号、密码、OTP/注册正文发往该runtime选择的API，形成F-0083/RV-0012。未读取live JSON，故不是P0。
- [P2][E-AU-019-003/006] build-known节点会先渲染且禁止重渲染，但runtime仍替换全局registry；页面props与提交时服务配置可来自两个版本，形成F-0084。runtime 5xx/网络/格式错误还会覆盖已可用的build页面，形成F-0085。
- [P2][E-AU-019-007] audience切换重写整个query，只保留目标必需参数，丢失`login_intent`等跨节点上下文，形成F-0086。
- [P2][E-AU-019-009] Operator找回密码在验证码发出后修改手机号不会清除challenge；界面可显示B手机号但提交仍重置challenge绑定的A账号，形成F-0087。
- [P3][E-AU-019-010/011/012] CSRF重试生成新幂等键；共享L1制品仍发布L0 canonical/OG metadata；测试大量使用fetch mock且当前Consumer页、runtime bootstrap错误和畸形2xx没有行为测试，分别形成F-0088至F-0090。
- [FACT] 既有F-0005（approved UI漂移）和F-0007（九处safeParse结果丢弃）经逐文件复核继续成立，没有重复编号。

本AU新增P1候选1项、P2 4项、P3 3项；累计P0 0、P1候选10、P2 44、P3 35、NIT 1。新增G1 2项、GX 1项；累计G0 2、G1 21、G2 2、G3 0、GX 2。

## 4. 验证与未知

- 正式`npm test`与`npm run lint`均因固定审计工作树缺`vitest`/`tsc`在加载源码前以127退出；未安装依赖。
- 通过静态import、全仓字符串/发布入口、runtime parser和Caddy生成链交叉核对；没有执行会写`dist`的build。
- [UNKNOWN] 两个线上runtime JSON当前内容、CORS实际允许方、线上Auth bundle版本与真实页面行为；均未访问。
- [UNKNOWN] owner-approved所指LoginPage与当前Consumer/Operator页面哪套是Ethan现行批准界面；审计不替产品裁定。
