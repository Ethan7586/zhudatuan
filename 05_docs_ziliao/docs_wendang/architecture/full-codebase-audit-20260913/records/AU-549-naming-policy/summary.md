# AU-549｜生产命名政策配置

- 审阅范围：`02_platform_pingtai/config/naming.yml`（13 行）；定向检索 scripts、workflow、release/config consumers。
- 审阅方式：配置与全仓静态消费者人工核对；未运行质量命令。

## 审计结论

- **G1 / DC-0070**：该 YAML 表达 production directory/file regex 与六个例外类别，但固定基线仅有配置清单本身命中；没有仓内 script、workflow、release gate 或 package command 读取它。
- 该政策不能在当前仓内阻止带连字符/下划线的文件名，也没有发现程序将 exceptions 作为 allow-list 消费。文档中出现的是过期的旧路径说明，不能证明当前运行职责。
- 不作删除结论：外部 lint/AI governance、人工审查或未纳入仓库的 delivery policy 仍可能引用；尚未排除历史兼容、权威文本责任和替代命名规则。

## 未验证项

- 未查外部 CI、delivery agent、团队审查流程或 LAW 已启用标准是否读取/复述该 policy；未做违例文件的反事实阻断验证。
