const PAYMENT_FIELDS = ['timeStamp', 'nonceStr', 'package', 'signType', 'paySign'] as const;

export async function requestWechatPayment(action: Readonly<Record<string, string>>): Promise<void> {
  const values = Object.fromEntries(PAYMENT_FIELDS.map((name) => [name, required(action, name)])) as unknown as {
    readonly timeStamp: string;
    readonly nonceStr: string;
    readonly package: string;
    readonly signType: string;
    readonly paySign: string;
  };
  await new Promise<void>((resolve, reject) => wx.requestPayment({ ...values, success: resolve, fail: reject }));
}

function required(action: Readonly<Record<string, string>>, name: (typeof PAYMENT_FIELDS)[number]): string {
  const value = action[name];
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) throw new Error(`MINIAPP_PAYMENT_ACTION_INVALID:${name}`);
  return value;
}
