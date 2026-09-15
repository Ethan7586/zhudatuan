# AU-809｜Console 不可变制品摘要

- 审阅范围：`release/console-digest.mjs`（21 行）与声明文件（1 行）。
- 结论：基于共享稳定文件枚举，对所有制品路径及字节计算`sha256:`摘要，显式排除`console-build.json`避免制品证据自引用；只由 Console artifact reader 导入。纯读取，**G0**，无新 finding。
