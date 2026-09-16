# AU-543｜平台配置目录 LAW 入口

- 审阅范围：`02_platform_pingtai/config/LAW.md`（5 行）及其唯一显式上游 `LAW.md`。
- 审阅方式：权威链接、声明语义和当前目录边界人工核对；不涉及运行/测试。

## 真实治理关系

Ethan 当前决定 → 根 `LAW.md`（唯一项目权威入口）→ 已启用治理/SFL/主打团/疆域标准；`02_platform_pingtai/config/LAW.md` 不新增规则，只要求配置阅读者先回到根 LAW，并将未启用配置说明、测试、历史文档和报告降为资料。

## 审计结论

- **G0**：相对路径根 LAW 链接有效；局部 LAW 的“不定义独立最高规则”与根 LAW 的权威开关模型一致，避免 platform config 文件自身越权成为规则源。
- 当前 config 目录包含 node manifest、artifact/bundle/cache/capacity 等实际运行配置；该 LAW 负责其人工治理读取顺序，不是部署/运行时被程序加载的配置。

## 未验证项

- 未逐份审阅根 LAW 已启用标准及本目录全部配置，也未核对外部操作者是否遵守该文档；这些均由后续专项审计处理。
