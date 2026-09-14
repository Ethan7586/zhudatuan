# AU-222｜Commerce HealthProbe 深审

HealthProbe是SmokeMain发布冒烟的唯一HTTP验证器。它正确拒绝非2xx、无效JSON/status和redirect，但没有将请求probe与返回status绑定，可能对错误handler产生成功结论；记录F-0214/P2。无P0/P1问题。
