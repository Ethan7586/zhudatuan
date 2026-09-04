import { localInfrastructureEnvironment } from '@shop/config/server';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { bytesResponse, jsonBody, jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
import { LocalObjects } from './LocalObjects';

const environment = localInfrastructureEnvironment();
const port = environment.objectsPort;
const objects = new LocalObjects(environment.objectsDirectory, environment.objectsToken, `https://127.0.0.1:${port}`);
await objects.initialize();

const handler: LocalHandler = async (request) => {
  if (request.url.pathname === '/health/ready') {
    return request.method === 'GET' ? jsonResponse(200, { status: 'ready' }) : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  }
  const publicMatch = /^\/v1\/public\/([^/]+)$/.exec(request.url.pathname);
  if (publicMatch && request.method === 'GET') {
    const value = await objects.readAuthorized(decodeURIComponent(publicMatch[1] ?? ''), request.url.searchParams.get('expires'), request.url.searchParams.get('signature'));
    return bytesResponse(200, value.bytes, value.metadata.contentType);
  }
  const publicUpload = /^\/v1\/public-upload\/([^/]+)$/.exec(request.url.pathname);
  if (publicUpload && request.method === 'PUT') {
    await objects.writeAuthorized(decodeURIComponent(publicUpload[1] ?? ''), request.url.searchParams.get('expires'),
      request.url.searchParams.get('signature'), request.headers, request.body);
    return { status: 204 };
  }
  objects.authorizeHeader(request.headers.authorization);

  if (request.url.pathname === '/v1/uploads' && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(201, { id: objects.create(body.path, body.contentType) });
  }
  if (request.url.pathname === '/v1/uploads/authorizations' && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(200, objects.authorizeUpload({ path: body.path, contentType: body.contentType, size: body.size,
      sha256: body.sha256, expiresIn: body.expiresIn, retentionUntil: body.retentionUntil }));
  }
  const part = /^\/v1\/uploads\/([^/]+)\/parts\/(\d+)$/.exec(request.url.pathname);
  if (part && request.method === 'PUT') {
    objects.append(decodeURIComponent(part[1] ?? ''), Number(part[2]), request.body);
    return { status: 204 };
  }
  const completion = /^\/v1\/uploads\/([^/]+)\/completion$/.exec(request.url.pathname);
  if (completion && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(200, await objects.complete(decodeURIComponent(completion[1] ?? ''), body.parts, body.sha256, body.size));
  }
  const upload = /^\/v1\/uploads\/([^/]+)$/.exec(request.url.pathname);
  if (upload && request.method === 'DELETE') {
    objects.abort(decodeURIComponent(upload[1] ?? ''));
    return { status: 204 };
  }
  if (request.url.pathname === '/v1/objects/metadata' && request.method === 'GET') {
    const path = request.url.searchParams.get('path');
    if (path !== null) {
      const found = await objects.find(path);
      return found ? jsonResponse(200, found) : jsonResponse(404, { code: 'OBJECT_NOT_FOUND' });
    }
    return jsonResponse(200, await objects.inspect(request.url.searchParams.get('reference') ?? ''));
  }
  if (request.url.pathname === '/v1/objects' && request.method === 'GET') {
    const value = await objects.read(request.url.searchParams.get('reference') ?? '');
    return bytesResponse(200, value.bytes, value.metadata.contentType);
  }
  if (request.url.pathname === '/v1/objects' && request.method === 'DELETE') {
    await objects.remove(request.url.searchParams.get('reference') ?? '');
    return { status: 204 };
  }
  if (request.url.pathname === '/v1/objects/locks' && request.method === 'POST') {
    const body = jsonBody(request);
    if (body.mode !== 'compliance') return jsonResponse(400, { code: 'OBJECT_LOCK_MODE_INVALID' });
    return jsonResponse(200, await objects.lock(typeof body.reference === 'string' ? body.reference : '', body.until));
  }
  if (request.url.pathname === '/v1/objects/authorizations' && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(200, await objects.authorize(typeof body.reference === 'string' ? body.reference : '', body.expiresIn));
  }
  return jsonResponse(404, { code: 'OBJECT_ROUTE_NOT_FOUND' });
};

await startLocalHttps('localobjects', port, handler, {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, IMPORT_CAPACITY.maximumFileBytes);
