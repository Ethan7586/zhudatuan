# AU-962｜未编号 GX 台账重建

- 方法：只读比对 `05-dead-code-candidates.md` 的 38 个唯一 GX ID、AU-906 索引与所有首审 `summary.md` 的对象级 GX 结论；不重审已完成的 GX 调用链，不执行运行、迁移或构建。
- 已恢复的 12 个对象：DC-0028 Cakeuncle webhook/签名边界、DC-0031 Cake order request、DC-0034 Meal order draft、公司模板克隆（AU-702）、Storefront compatibility legacy 运维（AU-746）、Linux readiness fixture（AU-760）、身份手机号一致性修复（AU-767）、供应商业务模拟 SQL（AU-804）、Console 构建编排（AU-812）、需求生成器（AU-820）、VI 资产发布包（AU-822）和 release inventory 脚本（AU-823）。
- 结论：历史的 `GX 52` 与可枚举 ID 的差额不能直接解释为 14 个真实对象；目前有 12 个可追溯对象与 2 个仅存在于累计数字的未知项。所有 12 个对象保持高风险、禁止删除/执行；两个未知项不能被虚构、清零或视为已复核。
- 后续：为 12 个对象分配稳定 GX ID 后逐项从运行入口重审；两个计数未知项须通过历史候选变更与提交证据追溯。未发现 P0；未修改生产代码、测试、配置或外部状态。
