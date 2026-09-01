// Generated from @shop/contract DeepLinkContract. Do not edit.
const routes = Object.freeze(["productdetail","orderdetail"]);

/** @param {unknown} value */
function parse(value) {
  if (typeof value !== 'string') throw new Error('DEEPLINK_INVALID');
  const match = /^\/page\/([a-z]+)\/index\?id=([A-Za-z0-9:%._-]{1,255})$/.exec(value);
  const route = match?.[1]; const id = match?.[2];
  if (!route || !id || !routes.includes(route)) throw new Error('DEEPLINK_INVALID');
  return Object.freeze({ route, id, url: `/page/${route}/index?id=${id}` });
}
module.exports = { parse, routes };
