# AU-828｜顶层文档入口与发布说明

- 审阅范围：`README.md`（29 行）、`ARCHITECTURE.md`（26 行）与 `ALIYUN-OSS-CDN-SHARED-MEDIA.md`（12 行）；逐条交叉核对本仓路径、VI 资产使用、release adapter 和受控交付规则。
- 新发现：**F-0320/P2**。README 仍链接不存在的 `zdt.md`/根目录 VI 1.3；架构图仍描述单 Commerce 生产单元，而当前 adapter 存在多个 API/Jobs target；OSS/CDN 文档仍把旧 `deploy.sh` 写作生产发布入口。
- 这些都是人工入口而不是自动运行输入，未触发部署、网络或文件写入；但会误导运行边界和发布操作，须从最新主线以独立文档控制面批次修正，并由发布负责人复核。
