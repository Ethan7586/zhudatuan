# AU-735｜阿里云模板交付核心

- 审阅范围：`Dockerfile`、`delivery.yml`、`migration.template.yml`、`runtime.template.yml`、`backup.yml`。
- 审阅方式：深入审阅镜像构建、客户端制品指针、Migration/Api/Jobs 启动与探针、安全上下文和模板 API；备份策略作结构性审阅。未执行构建、kubectl、发布或云端读取。

## 审计结论

- `Dockerfile` 将 Commerce build 产物和数据库迁移装入非 root Node runtime；delivery 声明六端 OSS 不可变制品和 API/Jobs/Migration 运行关系；migration/runtime 模板分别调度 `MigrationMain.js`、`ApiMain.js`、`JobsMain.js`，不应按静态引用删除。
- **边界漂移：** `DEPLOY-阿里云.md` 将这些模板称作配置真值，而 hbbtzn 项目 README 同时称 `../../aliyun/delivery.yml` 为旧部署参考、且正式发布资格为 false。仓内 `check/deployment.mjs` 仅以字符串读取它们，未 YAML/Kubernetes 解析。
- 新增 F-0294：runtime 模板三个 `apiVersion: 01_core_hexin/apps/v1` 写法在被 Kubernetes 应用时不是合法的内置 Deployment API；未证明它是当前正式发布输入或已触发线上失败，因此为 P2、需独立复核。
- `backup.yml` 是策略声明而非实际云资源状态；未验证 RDS/OSS/KMS 是否实际配置。
