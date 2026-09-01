// Generated from @shop/config MiniappEnvironment. Do not edit.
const schema = [
  {
    "key": "apiBaseUrl",
    "pattern": "^https://[a-z0-9.-]+(?::[0-9]+)?(?:/[^?#]*)?$",
    "code": "MINIAPP_API_BASE_URL_INVALID"
  },
  {
    "key": "mallId",
    "pattern": "^[a-zA-Z0-9:.-]{3,255}$",
    "code": "MINIAPP_MALL_ID_INVALID"
  },
  {
    "key": "clientVersion",
    "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
    "code": "MINIAPP_CLIENT_VERSION_INVALID"
  }
];

/** @typedef {{apiBaseUrl: string, mallId: string, clientVersion: string}} MiniappEnvironment */
/** @param {Readonly<Record<string, unknown>>} source @returns {Readonly<MiniappEnvironment>} */
function environment(source) {
  const values = /** @type {Record<string, string>} */ ({});
  for (const field of schema) {
    const value = source[field.key];
    if (typeof value !== 'string' || !new RegExp(field.pattern, 'i').test(value)) throw new Error(field.code);
    values[field.key] = value;
  }
  return Object.freeze({ apiBaseUrl: String(values.apiBaseUrl).replace(/\/$/, ''), mallId: String(values.mallId), clientVersion: String(values.clientVersion) });
}

module.exports = { environment };
