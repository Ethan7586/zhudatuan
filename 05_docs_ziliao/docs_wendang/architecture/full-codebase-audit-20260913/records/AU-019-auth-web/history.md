# AU-019 历史与漂移

- 固定基线内README和owner-approved材料仍描述`LoginPage`三段式登录；实际App挂载Consumer/Operator双页，延续F-0005。
- Auth静态制品同时进入L0与L1发布target；L1 gateway额外提供`identity-runtime.json`，L0旧Caddy静态fallback对该路径返回HTML。
- 本AU不以历史文档决定现行UI，不据零引用删除兼容代码；后续主线变化只进入增量审计。
