# AU-813｜本地工具 TypeScript 配置

- 审阅范围：`localinfra`、`localkms`、`localobjects`、`localsecrets`四份`tsconfig.json`。
- 结论：四份同构配置都继承根tsconfig、限定Node/ES2022库并仅include自身src；不存在跨工具include、emit或路径别名差异。其对应运行单元由本地服务/构建脚本调用，配置文件本身不启动服务，均为 **G0**，无新 finding。
