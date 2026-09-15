# AU-808｜发布制品哈希库

- 审阅范围：`release/artifacts.mjs`（33 行）及其 candidate/validatebundle/console digest/inventory 调用者。
- 结论：库只读取文件系统，稳定按名称排序递归，以相对路径和原始字节计算SHA-256；符号链接等特殊目录项会拒绝。是发布制品一致性和来源校验的共享基础，定为 **G0**，无新 finding。
- 边界：未运行会读取候选制品、生成inventory或触发发布流程的调用者；本结论不证明任何现有制品可信。
