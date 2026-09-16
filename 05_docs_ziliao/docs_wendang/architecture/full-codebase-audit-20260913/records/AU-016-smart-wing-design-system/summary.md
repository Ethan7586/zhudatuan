# AU-016｜`@smart-wing/design-system` 旧设计令牌包

## 1. 边界

- 固定基线`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点CP-15 `0d9ab10e`。
- 审阅8/8文件、562/562行：package、2个JSON、4个SVG逐字段/节点深审；139行CSS按生成物核对来源、变量集合和消费者。
- 反追package依赖、动态/静态import、字符串路径、token生成器、正式前端检查和canonical `@shop/design`等价面。
- 不改视觉资产、不生成文件、不运行页面、不修复/删除/推送/合并/部署。

## 2. 结论

[FACT][E-AU-016-002/003] 固定仓库没有任何源码、CSS、构建脚本或运行配置消费该包的export；Storefront只在package.json/lock中声明依赖。正式Console和构建脚本均使用`@shop/design`或`packages/design`。

[CONFLICT][E-AU-016-004] Storefront的无实际import依赖仍把旧包留在workspace依赖/发布影响图，形成F-0074/P3。零代码引用不等于可删除，整个包列DC-0020/G2，等待仓外消费者、构建和视觉回归复核。

[CONFLICT][E-AU-016-005/006] 旧`tokens.css`声称由当前`build-web-tokens.mjs`从旧JSON生成，但脚本只读写canonical `packages/design`。正式`--check`通过时完全不检查旧CSS；旧包仍是1.0“智慧翼/会员码”，canonical已是1.2“主打团/翼码”，CSS变量79对82，形成F-0075/P3。

四个SVG XML均合法；brand-mark、lockup、wing-pattern与canonical字节相同，wing-code-symbol不同。JSON可解析，size class区间闭合无重叠。

本AU新增P3 2项、G2 1项。累计P0 0、P1候选9、P2 37、P3 28、NIT 1；G0 2、G1 16、G2 2、G3 0、GX 1。

## 3. 验证与未知

- package没有test/typecheck/build scripts；正式workspace test/typecheck均返回Missing script。
- canonical web-token `--check`返回0，只证明`@shop/design`输出当前，不证明旧包CSS可重生。
- [UNKNOWN] 仓外工具是否按workspace包名读取旧exports；[UNKNOWN] 删除依赖后Storefront build/页面视觉是否完全不变。
- 因公共workspace export、锁文件依赖、仓外未知和未做视觉复核，不满足G3。
