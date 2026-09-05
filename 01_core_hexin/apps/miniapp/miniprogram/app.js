const { environment } = require('./config/Environment');

const runtimeEnvironment = environment(wx.getExtConfigSync());

App({
  globalData: {
    environment: runtimeEnvironment,
  },
});
