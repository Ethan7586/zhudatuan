export function scanMiniappCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: ({ result }) => {
        const value = result.trim();
        if (value.length === 0 || value.length > 2048) reject(new Error('MINIAPP_SCAN_RESULT_INVALID'));
        else resolve(value);
      },
      fail: reject,
    });
  });
}
