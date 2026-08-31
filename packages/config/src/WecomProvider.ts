export const WECOM_PROVIDER_CONFIGURATION = Object.freeze({
  corp: Object.freeze({
    authorize: 'https://open.weixin.qq.com/connect/oauth2/authorize',
    token: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
    user: 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo',
    departments: 'https://qyapi.weixin.qq.com/cgi-bin/department/list',
    users: 'https://qyapi.weixin.qq.com/cgi-bin/user/list',
  }),
  suite: Object.freeze({
    authorize: 'https://open.work.weixin.qq.com/wwopen/sso/3rd_qrConnect',
    suiteToken: 'https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token',
    loginInfo: 'https://qyapi.weixin.qq.com/cgi-bin/service/get_login_info',
    permanentCode: 'https://qyapi.weixin.qq.com/cgi-bin/service/get_permanent_code',
    corpToken: 'https://qyapi.weixin.qq.com/cgi-bin/service/get_corp_token',
  }),
  tokenRefreshSkewSeconds: 300,
  requestsPerSecond: 20,
  pageSize: 100,
  maximumPages: 10_000,
});
