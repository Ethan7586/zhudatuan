import { loadNodeManifest, localInfrastructureEnvironment, type NodeManifest } from '@shop/config/server';
import { bytesResponse, jsonBody, jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
import { LocalObjects } from './LocalObjects';

const environment = localInfrastructureEnvironment();
const manifest = await nodeManifest(process.env);
const port = environment.objectsPort;
const objects = new LocalObjects(
  environment.objectsDirectory,
  environment.objectsToken,
  `https://127.0.0.1:${port}`,
);
await objects.initialize();

const handler: LocalHandler = async request => {
  if (request.url.pathname === '/health/ready') {
    return request.method === 'GET' ? jsonResponse(200, { status: 'ready', ...(manifest ? nodeEvidence(manifest) : {}) })
      : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  }
  const publicMatch = /^\/v1\/public\/([^/]+)$/.exec(request.url.pathname);
  if (publicMatch && request.method === 'GET') {
    const value = await objects.readAuthorized(decodeURIComponent(publicMatch[1] ?? ''), request.url.searchParams.get('expires'), request.url.searchParams.get('signature'));
    return bytesResponse(200, value.bytes, value.metadata.contentType);
  }
  objects.authorizeHeader(request.headers.authorization);

  if (request.url.pathname === '/v1/uploads' && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(201, { id: objects.create(body.path, body.contentType) });
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
  if (request.url.pathname === '/v1/objects/authorizations' && request.method === 'POST') {
    const body = jsonBody(request);
    return jsonResponse(200, await objects.authorize(typeof body.reference === 'string' ? body.reference : '', body.expiresIn));
  }
  return jsonResponse(404, { code: 'OBJECT_ROUTE_NOT_FOUND' });
};

await startLocalHttps('localobjects', port, handler, {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
});

async function nodeManifest(source: NodeJS.ProcessEnv): Promise<NodeManifest | null> {
  if (!source.NODE_MANIFEST_PATH) return null;
  return loadNodeManifest(source.NODE_MANIFEST_PATH, {
    manifestId: required(source.NODE_MANIFEST_ID, 'NODE_MANIFEST_ID_MISSING'),
    manifestDigest: required(source.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_MISSING'),
    runtimeInstanceId: required(source.NODE_RUNTIME_INSTANCE_ID, 'NODE_RUNTIME_INSTANCE_ID_MISSING'),
    runtimeConfigRef: required(source.NODE_RUNTIME_CONFIG_REF, 'NODE_RUNTIME_CONFIG_REF_MISSING'),
    resourceBindingVersion: required(source.NODE_RESOURCE_BINDING_VERSION, 'NODE_RESOURCE_BINDING_VERSION_MISSING'),
    releasePointerRef: required(source.NODE_RELEASE_POINTER_REF, 'NODE_RELEASE_POINTER_REF_MISSING'),
  });
}

function nodeEvidence(manifest: NodeManifest) {
  return {
    manifestId: manifest.manifest_id,
    manifestVersion: manifest.manifest_version,
    manifestDigest: manifest.manifest_digest,
    runtimeInstanceId: manifest.runtime_instance_id,
    resourceBindingVersion: manifest.resource_binding_set_ref.version,
    nodeId: manifest.node_id,
    scopeId: manifest.data_scope_ref.ref,
  };
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
