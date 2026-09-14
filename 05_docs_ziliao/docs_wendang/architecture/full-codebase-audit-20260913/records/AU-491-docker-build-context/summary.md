# AU-491｜Docker 构建上下文排除规则深审

- 审阅对象：仓库根 `.dockerignore`（13 行）。
- 方法：人工审阅全部 pattern；静态追溯根 package 脚本、本地 compose、阿里云 Dockerfile、部署校验脚本与 CI 配置。未构建镜像、未启动 compose、未访问 registry/线上环境。

## 真实边界

根规则在 Docker 以仓库根为 context 构建时自动生效。阿里云 Dockerfile 从该 context 精确复制 package/lock、构建脚本、Commerce/平台源码与数据库配置；规则排除 Git 元数据、CI 元数据、本地 env/dev vars、缓存、coverage、dist 和 node_modules，避免把密钥及机器产物送进 builder。Dockerfile 以 `npm ci` 重建依赖和 `npm run build:commerce` 产生运行制品；本地 compose 仅运行 PostgreSQL/Redis，不使用此 Dockerfile。

## 结论

- **G0**：不是垃圾，是容器构建的隐式安全/可重复构建契约；删除会使使用仓库根 context 的构建重新包含本地凭据与大体积产物。
- 固定基线未找到正式 workflow 的 `docker build` 调用，因此该 Dockerfile 的正式制品触发入口尚未验证；这不足以否定 `.dockerignore` 的 Docker 语义，也不构成删除证据。
- 未发现新增 P0–P3。未验证 Docker context 是否总在根目录、ignore 后文件是否足够构建、镜像内容、构建缓存及阿里云实际制品通道。
