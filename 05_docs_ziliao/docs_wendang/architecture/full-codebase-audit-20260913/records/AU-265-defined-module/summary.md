# AU-265｜DefinedModule 深审

`defineModule`按契约目录为模块注册全部API操作；`defineSelectedModule`在构建时拒绝重复或跨模块操作，再只注册白名单。二者均仅在API workload安装handlers/routes。无P0–P3新问题。
