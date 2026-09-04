import { errorStatus, type ApiErrorCode } from '@shop/contract';

export function routeResponse(code: ApiErrorCode): Response {
  return new Response(code, {
    status: errorStatus(code),
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
