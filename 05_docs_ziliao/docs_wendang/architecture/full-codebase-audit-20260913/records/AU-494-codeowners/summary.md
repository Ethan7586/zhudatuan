# AU-494｜GitHub 代码责任映射深审

- 审阅对象：`.github/CODEOWNERS`（9 行）。
- 方法：人工审阅全部 pattern 与注释；静态核对被覆盖的 Console 订单页面、Web 订单读模型、仓内 workflow 和已有治理文档。未查询 GitHub 分支保护、团队成员或审批记录。

## 结论

- **G0**：文件对 GitHub PR 的 code-owner 匹配具有真实责任映射，不是删除候选。
- 当前覆盖自身、Console 订单 feature 目录和两份 WebOrderOperations 文件，均直接存在。它表达的是 Ethan 负责的映射；它本身不能证明 GitHub 已启用 required code-owner review。
- 仓内历史治理文档提到 branch protection 可能未强制，但本轮不以历史文档替代 GitHub 当前配置证据。远端强制状态、实际审批人和规则集均标记未验证。未发现新增 P0–P3。
