# RV-0001｜Auth/Console 公网入口与发布制品指针独立复核

## 边界与方法

- 固定审计基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；本次没有使用主线后续提交推断结论。
- 本轮从运行入口重新取证：公网 GET → 节点 manifest/domain binding → 发布 target 与 remote-policy pointer → Caddy 静态根 → 发布器验收逻辑。没有复用首审的主机文件、回执或结论作为本轮事实前提。
- 只进行了两个公网 GET；没有登录、写入、部署、指针切换、服务操作或云资源操作。

## 独立事实链

1. `02_platform_pingtai/config/node-manifests/zhudatuan-l0.json:17-23,44-50` 将 `accounts.fufu.wang` 绑定为 identity surface、`console.fufu.wang` 绑定为 console surface。
2. 2026-09-15 的只读 GET 分别返回 `accounts.fufu.wang/` **404**、`console.fufu.wang/` **404**。这只能证明根入口当前不可加载；没有据此推断用户数量、起始时间或其它路径状态。
3. `02_platform_pingtai/infrastructure/release/zdt-next.release.json:65-101` 将 Auth、Console 构建输出打包为 `static`；`zdt-next.remote-policy.json:45-46` 只会原子更新 `/opt/zhudatuan/targets/{auth-web,console}/current`，并只检查候选制品中 `static/index.html` 存在。
4. `02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile:25-28,54-57,84-87` 的 fufu 登录、Auth 根和 Console 根却读取 `/opt/zhudatuan/current/01_core_hexin/apps/{auth-web,console}/dist`，不是发布器更新的 target pointer。
5. `04_tools/release-engine/src/engine.mjs:398-447,544-569` 显示 Direct 发布不执行外部基线/target 验收；非 Direct 只有声明了 `publicAcceptance` 的 target 才会作单目标公网检查。release manifest 仅为 Console 声明 `https://console.fufu.wang/` 的 200 验收（`zdt-next.release.json:584-611`），Auth 没有对应验收；remote policy 两个前端 target 的 healthChecks 都为空。

## 裁决

- **F-0001 确认 P1，高置信度。** 两个被 node manifest 声明的用户/运营公网根入口当下稳定返回 404；仓库中的正式发布路径不能更新 Caddy 实际静态根，且正式 Direct 交付不执行可捕捉该问题的公网验收。该组合足以证明高概率的关键前端可用性故障。
- 不是 P0：没有发现正在发生的数据损坏、权限突破、资金风险或全系统中断的直接证据；影响人数、持续时间、替代入口和资产子路径均未验证。
- 根因仍限于“运行根与发布 pointer 的权威分裂”；不把历史 Caddy 安装过程、DNS/边缘配置或某个具体人为变更归因为事实。
- 不形成 G3 或任何删除建议。旧 runtime root 可能仍承担其它服务、回滚或过渡兼容责任。

## 后续独立修复批次的最小范围

1. 在当时最新 `zdt-next` 新建单目的修复分支，先确定唯一运行 root 的权威归属。
2. 让 Caddy 静态根与该 target 的原子 current pointer 一致，或将发布器正式切换到 Caddy 实际读取的 root；不得同时猜测性改两套控制面。
3. 为 Auth 和 Console 都设置与真实公网 host 相同的 GET 200 验收，并确保 Direct 流程不再绕过该验收。
4. 验证两入口根页、静态资源、Auth API 反代、Console 兼容 Auth 路由及未受影响的其它域名；保留原 pointer/Caddy 以按正式流程回滚。

## 复核纪律

- 本记录是 RV-0001 的第二轮入口重追，不是修复，也没有启动修复。
- 仍需在实际修复变更提出时进行变更后复核；该复核不能代替上线验收。
