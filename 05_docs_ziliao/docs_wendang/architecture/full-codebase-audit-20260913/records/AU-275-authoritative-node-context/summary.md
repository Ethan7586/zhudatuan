# AU-275｜AuthoritativeNodeContextResolver 深审

权威节点resolver只接受唯一数据库上下文；scope resolver对self/ancestors/descendants/subtree均传line/node双键，并拒绝跨line记录。fixture覆盖全部四个closure函数。无P0–P3新问题。
