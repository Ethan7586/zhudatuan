# AU-009 定向验证结果

| 验证入口 | 退出 | 结果分类 | 可证明 | 不可证明 |
| --- | ---: | --- | --- | --- |
| `npm test --workspace @shop/kernel` | 127 | 环境阻塞：`vitest` command not found | 正式入口名称与依赖未安装事实 | 9 个测试通过/失败、生产正确性 |
| `npm run typecheck --workspace @shop/kernel` | 127 | 环境阻塞：`tsc` command not found | 正式 typecheck 入口与依赖未安装事实 | 类型检查通过/失败 |
| Node 22 transform-types：Circuit 并发顺序 | 0 | 只读反事实命中 | failed request 打开后，旧 success 会关闭 circuit | 线上发生频率 |
| Node 22 transform-types：half-open classifier 抛错 | 0 | 只读反事实命中 | state=`halfopen`、下一次=`CIRCUIT_OPEN` | 当前 classifier 是否会抛 |
| Node 22 transform-types：ModuleCatalog mutation/duplicate | 0 | 只读反事实命中 | 可见 manifest 与 capability index 分裂；重复 capability 自身造成 ambiguity | 生产 startup 影响（当前无 caller） |
| Node 22 transform-types：ValueObject equality | 0 | 只读反事实命中 | 不同 Date 相等；NaN 与 Infinity 相等 | 当前 PaymentReference 受影响（其值均为 string） |
| Node 22 transform-types：TestId/Id seam | 0 | 只读反事实命中 | sequence=18 生成含 `I` 的候选并由实际 `Id.parse` 拒绝 | 仓外测试调用频率 |
| Node 22 transform-types：Currency runtime mutation | 0 | 只读反事实命中 | `CURRENCIES.push('USD')` 改变 validator 接受集，实例 code 也可改写 | 生产 mutation 频率 |
| 35 manifest capability 静态复算 | 0 | 结构一致性反证 | 35/51/92/37 数量与具体 missing 对 | 这些 manifest 的未来产品意图 |
| 40 文件确定性抽检 | 0 | 同一主审逆向复核 | 5/40 从消费者重追，首次结论一致 | 独立第二审阅者结论 |

未运行完整仓库测试或 production build；这是单模块审计，且全量验证只允许最终总收口一次。没有安装依赖或修改锁文件。
