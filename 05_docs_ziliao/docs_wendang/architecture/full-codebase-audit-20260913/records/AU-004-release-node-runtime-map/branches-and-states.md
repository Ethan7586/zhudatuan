# AU-004｜发布、激活与恢复状态

## Direct 主路径

1. 人工选择 ref、node 和可选 target；workflow checkout 精确 ref。
2. affected 模式固定计算 `HEAD^..HEAD`；显式 target 模式直接指定 target。
3. planner 以 direct 模式清空 preflight/tests/typecheck/approval；build/package 仍执行。
4. agent `stage --direct` 校验制品并跳过 candidate checks。
5. `activate-direct` 校验 source/candidate；若 already-current 返回成功。
6. 非 migration target 切 current/runtime 并执行声明的 restart；restart 抛错时恢复原 pointer。
7. restart 成功即形成 direct success receipt；不进入 readiness、外部域名验收或健康失败自动回滚。
8. migration 仍为 forward-only；数据库效果不由 pointer rollback 撤销。

## Guarded 路径（仓库实现但正式 Direct 不调用）

1. stage candidate 并运行 candidate checks。
2. preflight 采集 capacity、current/previous/runtime、Caddy semantic、目标/受保护进程。
3. 校验 production approval、expected current 与 expected Caddy semantic。
4. 记录 rollback point 后切 pointer、restart。
5. 等待 readiness，比较 Caddy semantic、目标 PID 和受保护进程。
6. 可选执行外部域名 before/after acceptance。
7. 任一后置门禁失败则恢复 pointer、restart并验证 rollback readiness；数据库迁移仍不自动回滚。

## OSS Console 路径

1. 构建 Console 静态目录，生成 tar 与 manifest。
2. 上传 immutable OSS object，生成短期签名 URL。
3. SSH 把激活脚本通过 stdin 运行；下载并校验 SHA/source/release version。
4. 解包到 source 目录，验证 `static/index.html` 后原子切 `hbbtzn-l1/targets/console/current`。
5. 请求公网 release-version；不一致时恢复 previous current。
6. 该路径不持有 release agent target lock，因此与 Direct 的跨入口状态不是串行状态机。

## AutoNode 状态机

1. 只有显式 sovereign-upgrade capability 才能形成 plan。
2. `plan` 输出 exact digest；`apply`/`restore` 必须提交同一 digest。
3. activation ledger 按 FILES→RELEASE→RUNTIME→IDENTITY→TLS→TUNNEL→DNS→SYSTEMD→PROCESSES→HEALTH→ACTIVE 前进。
4. 中途失败按逆序 compensation；只撤销 receipt 标记为本次 owned 的资源。
5. retry 读取 ledger 收敛，不默认重复创建 tunnel/DNS/unit。
6. 固定基线上没有 workflow/package 正式运行入口；实际人工使用历史 UNKNOWN。

## Release retention 状态

1. timer 每小时且 Persistent；path 监看 legacy pointer。
2. service 构造 current、previous、runtime、进程 CWD、pin、recent、grace 保护集。
3. 只在允许 release roots 中删除不受保护候选。
4. 当前只读快照中 timer/path active，最近 service 成功；行为测试因本地 Bash 版本未执行。
