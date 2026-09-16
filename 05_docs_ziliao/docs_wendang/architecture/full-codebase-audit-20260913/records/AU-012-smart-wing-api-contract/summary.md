# AU-012｜`@smart-wing/api-contract` 兼容共享契约

## 1. 唯一目的与边界

本单元只审固定基线中 `@smart-wing/api-contract` 的全部11个文件，以及权限、支付状态、会员码、商品分类、多端契约与真实消费者的第一层接缝。不展开审Commerce API业务handler、Storefront页面或数据库迁移实现。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 开工检查点：CP-11A `cff0faf5`。
- 纳入：11文件/758行；10个运行时导出、35个类型导出、1个JSON subpath；86个permission、31个分类叶子、5项delivery capability、4个直接单元测试、33个包引用文件。
- 排除：线上流量/数据库、修复、删除、依赖安装、全量构建、推送、合并和部署。

## 2. 结论

[FACT][E-AU-012-002] 11/11文件、758/758行完成逐文件、逐字段和逐关键分支审阅。包本身无进程、端口、数据库或独立制品；权限和授权类型主要进入兼容Commerce API与Smart Wing Authz，商品分类JSON进入Storefront，支付/会员码常量进入对应兼容路由。

[CONFLICT][E-AU-012-005/006/007] `delivery-matrix.json`没有代码消费者，正式`check:delivery`验证的是另一套文件；矩阵四条微信证据路径不存在，却把三项能力标为双端release-ready，形成F-0063/P2与DC-0014/G2。

[CONFLICT][E-AU-012-004/008] 分类树31个叶子中只有`digital_mobile_accessory`引用不存在的L2 `digital_mobile`；数据库迁移会产生这个路径，Storefront叶子校验仍把它视为严格有效，形成F-0064/P2。

[FACT][E-AU-012-009] permission、risk目录和平台常量均为运行时可变对象，隔离进程可直接改写，补强既有F-0032/P2。包的4个测试由Storefront Vitest间接聚合但无自有test/typecheck脚本，补强F-0060/P3。

本AU新增P2 2项；补强既有P2 1项、P3 1项；新增G1 1项、G2 1项。累计P0 0、P1候选8、P2 36、P3 19、NIT 1；G0 2、G1 12、G2 1、G3 0、GX 1。

## 3. 值得保留

- 86个permission code与86条目录定义一一闭合、无重复，risk为low 23/elevated 6/high 32/critical 25。
- `toPaymentStatus`把订单已退款作为最高优先级，并把后端/支付尝试状态归一为六个客户端词汇；当前两个Commerce API调用点共享同一函数。
- 身份Membership、server-derived ResourceScope和AuthorizationDecision集中为兼容链共享类型，避免handler各自复制字段。
- 分类JSON是Storefront当前唯一机器分类输入，除一个父链缺口外其个code全局唯一，rail与featured引用闭合。

## 4. 测试与验证

- 两个permission测试验证code闭合、唯一性、非空元数据与四个critical样本；两个platform测试验证required/reserved平台顺序。
- 缺口：分类父链、delivery evidence可达性、全部critical集合、状态转换全矩阵、运行时不可变性。
- 本包直接test/typecheck均Missing script；根test会经Storefront include发现4个测试，依赖未安装故本AU未取得实际通过/失败结果。
- `check:delivery`因审计worktree未安装`yaml`而在加载阶段退出；其源码静态确认不读取本包delivery matrix。未把依赖缺失当作产品缺陷。

## 5. 删除与未知

- DC-0014/G2：delivery matrix无代码入口、证据断裂，但保存唯一的五项多端状态且文档仍称其权威，不能删除。
- DC-0015/G1：platform adapter/types及部分响应类型零仓内源消费者，但均从private package公共入口导出并承担明确未来兼容契约，不能按零引用删除。
- [UNKNOWN] 仓外消费者与外部发布系统是否读取上述公共契约/矩阵。
- [UNKNOWN] 线上`digital_mobile_accessory`商品数量和实际导航影响。

## 6. 检查点纪律

本单元只写审计报告和覆盖清单；没有修改生产代码、测试、配置、迁移、依赖、锁文件或生成物，没有连接线上、推送、合并或部署。
