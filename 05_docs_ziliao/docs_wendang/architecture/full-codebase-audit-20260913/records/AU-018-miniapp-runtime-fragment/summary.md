# AU-018｜Miniapp 运行片段与生成输出

## 1. 边界

- 固定基线 `5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-17 `39b1a602`。
- 审阅 9/9 文件、195/195 行：`app.js` 9行人工入口深入复核；其余8个生成物186行逐一核对生成器、来源、运行消费者和漂移入口。
- 反追四条生成链、微信启动入口、navigation/runtimegraph/test topology、release candidate和canonical contract/config/design源。
- 不补app.json/pages/API，不修改生成物，不安装依赖，不打开微信开发者工具，不修复、删除、推送、合并或部署。

## 2. 真实运行关系

[FACT][E-AU-018-002/003] 唯一人工入口 `app.js` 只读取 `wx.getExtConfigSync()`，调用生成的 Environment parser，再把结果写入 `App.globalData.environment`。9文件内没有页面、导航、API client、action dispatcher、队列、缓存使用或网络请求。

[FACT][E-AU-018-004] 8个生成物来自四条链：config schema→Environment；contract→experience/deeplink；platform YAML→CachePolicy/RuntimeLimits；design token/assets→WXSS/两个SVG。只有Environment被app.js运行引用；其余7个输出在当前Miniapp目录没有运行消费者。

## 3. 结论

[CONFLICT][E-AU-018-003/008/009] 当前片段、正式闸门和发布声明仍互相冲突：navigation因缺app.json立即ENOENT，test topology只检查app.js却返回通过，candidate会复制全部片段。AU-018补强既有F-0006，不把外部完整工程UNKNOWN改写成下线事实。

[CONFLICT][E-AU-018-005] 生成Experience parser没有canonical parser的100页/每页200块上限、required字符串trim/非空/255限制，反而拒绝canonical允许的缺失blocks。运行探针实际接受101页、201块和空白/空ID，形成F-0082/P3；当前生成模块零运行caller是降级因素。

[CONFLICT][E-AU-018-006] CachePolicy只冻结最外层，运行探针把`catalog.maximumSeconds`从300改成1，补强F-0032/P2；当前零Miniapp runtime consumer是缓解项。Environment null输入抛原生TypeError，且既有trim parity差异继续补强F-0033/P3。

[FACT][E-AU-018-007] 两个SVG与canonical源字节一致，WXSS theme check通过，YAML与两个runtime输出值一致；这证明生成内容当前，不证明片段可启动。7个无运行caller生成物列DC-0023/G1，因生成/发布/唯一契约和仓外消费未知，不满足G2/G3。

本 AU 新增 P3 1项、G1 1项，补强F-0006/F-0032/F-0033/F-0080/F-0081。累计 P0 0、P1候选9、P2 40、P3 32、NIT 1；G0 2、G1 19、G2 2、G3 0、GX 1。

## 4. 验证与未知

- theme check、SVG字节/XML、runtime/cache源值对照通过；app/env/contract/cache合成探针运行完成。
- Environment/contract checks因缺`tsx`、runtime config check因缺`yaml`在加载阶段失败；runtimegraph因缺`typescript`阻塞。未安装依赖。
- navigation因缺app.json返回ENOENT；test topology返回0，直接复现F-0006的判据冲突。
- [UNKNOWN] 外部完整小程序仓库、线上微信版本、实际发布消费者和ext config值；没有访问线上资源。

