// SFL 1.6 retirement sentinel.
// Production L1 domains are owned by the hbbtzn Tunnel and node-local gateway.
// This Worker intentionally has no upstream, proxy, rewrite, fallback, or public route.
export default {
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ code: 'SFL_EDGE_ROUTE_RETIRED' }), {
      status: 410,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
