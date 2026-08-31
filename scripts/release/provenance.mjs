import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fileHash } from './artifacts.mjs';

const output = process.argv[2] ? resolve(process.argv[2]) : undefined;
const commit = process.argv[3];
const image = process.argv[4];
const sbom = process.argv[5] ? resolve(process.argv[5]) : undefined;
if (!output || output === '/' || existsSync(output)) throw new Error('PROVENANCE_OUTPUT_MUST_NOT_EXIST');
if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('PROVENANCE_COMMIT_INVALID');
if (!/^oci-layout@sha256:[0-9a-f]{64}$/.test(image ?? '')) throw new Error('PROVENANCE_IMAGE_INVALID');
if (!sbom || !existsSync(sbom)) throw new Error('PROVENANCE_SBOM_MISSING');

const statement = Object.freeze({
  _type: 'https://in-toto.io/Statement/v1',
  subject: Object.freeze([{ name: 'commerce.oci.tar', digest: Object.freeze({ sha256: image.slice(image.indexOf(':') + 1) }) }]),
  predicateType: 'https://slsa.dev/provenance/v1',
  predicate: Object.freeze({
    buildDefinition: Object.freeze({
      buildType: 'https://github.com/Attestations/GitHubActionsWorkflow@v1',
      externalParameters: Object.freeze({ commit, workflow: process.env.GITHUB_WORKFLOW ?? 'local-verified-release' }),
      internalParameters: Object.freeze({ sbomSha256: fileHash(sbom) }),
      resolvedDependencies: Object.freeze([{ uri: `git+https://github.com/${process.env.GITHUB_REPOSITORY ?? 'local/zhudatuan'}@${commit}` }]),
    }),
    runDetails: Object.freeze({
      builder: Object.freeze({ id: `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'local/zhudatuan'}/actions/runs/${process.env.GITHUB_RUN_ID ?? 'local'}` }),
      metadata: Object.freeze({ invocationId: process.env.GITHUB_RUN_ATTEMPT ?? 'local' }),
    }),
  }),
});
writeFileSync(output, `${JSON.stringify(statement)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
readFileSync(output);
console.log(`provenance created: commit=${commit} sbom=${fileHash(sbom)}`);
