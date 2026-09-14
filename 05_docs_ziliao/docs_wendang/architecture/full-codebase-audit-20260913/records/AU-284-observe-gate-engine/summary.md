# AU-284｜观察门禁引擎深审

`GateEngine` 只执行声明为 observe 的门禁槽：逐槽调用已注册插件，将未注册和插件异常转成显式 observation，随后将冻结结果交给观察器；观察器异常不会改变原业务请求。`GateRegistry` 按 slot 管理插件，支持替换并返回旧插件。`HttpApp` 仅提取契约中 observe 槽；WebBusiness 运行时当前以空注册表把观测结果写入遥测日志，因此未安装插件会如实记录为 `not_applicable`，不会成为隐性拦截。

122 行引擎 fixture 覆盖 disabled/observe、插件失败、未安装插件和替换；HttpApp fixture 进一步验证观察门禁不改变 HTTP 响应、只运行声明过的操作并记录生产空插件状态。本轮为静态审计，未执行缺少依赖的 Vitest；未发现 P0–P3 新问题。
