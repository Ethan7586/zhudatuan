import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const topologyCodes = Object.freeze({
  'peer-horizontal': 'p',
  'multi-line-horizontal': 'm',
  'l0-l11-vertical-mixed': 'v',
});

export function createScaleInputManifest(criteria, runToken, capturedAt) {
  const scenarios = [];
  for (const nodeCount of criteria.scale_matrix.node_counts) {
    for (const topology of criteria.scale_matrix.topologies) {
      scenarios.push(createScenario(topology.id, nodeCount, runToken));
    }
  }
  return Object.freeze({
    schema_version: 'e11-scale-input-manifest-v1',
    captured_at: capturedAt,
    run_token: runToken,
    node_counts: criteria.scale_matrix.node_counts,
    topologies: criteria.scale_matrix.topologies,
    expected_scenario_count: criteria.scale_matrix.scenario_count,
    sovereign_control_count_per_scenario: criteria.scale_matrix.sovereign_control_count_per_scenario,
    scenarios,
  });
}

export async function collectSourceSnapshot(criteria, scale, capturedAt) {
  const entries = [];
  for (const root of criteria.source_inventory_scope.roots) {
    await collectSourceEntries(join(repositoryRoot, root), criteria.source_inventory_scope, entries);
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    scale,
    captured_at: capturedAt,
    file_count: entries.length,
    inventory_digest: `sha256:${inventoryDigest(entries)}`,
    entries,
  });
}

export async function buildSharedArtifact(criteria, sourceSha, outputDirectory, scenarioIds) {
  await mkdir(outputDirectory, { recursive: true });
  const markerPath = join(outputDirectory, 'e11-shared-version-marker.txt');
  await writeFile(markerPath, `${criteria.shared_build.marker}\n`, { flag: 'wx' });
  const arguments_ = ['04_tools/scripts/release/build-runtime-bundle.mjs', 'identity-api', outputDirectory, sourceSha];
  const startedAt = new Date().toISOString();
  const stdout = await capture('node', arguments_);
  const completedAt = new Date().toISOString();
  const artifactEntries = await collectArtifactEntries(outputDirectory);
  const artifactIdentity = `sha256:${inventoryDigest(artifactEntries)}`;
  const releaseVersion = JSON.parse(await readFile(join(outputDirectory, 'release-version.json'), 'utf8'));
  return Object.freeze({
    build_invocations: [
      {
        invocation_id: 'e11-shared-identity-api-build-1',
        scope: 'shared-runtime',
        assigned_node_id: null,
        command: `node 04_tools/scripts/release/build-runtime-bundle.mjs identity-api <temporary-output-directory> ${sourceSha}`,
        source_sha: sourceSha,
        started_at: startedAt,
        completed_at: completedAt,
        exit_code: 0,
        stdout: stdout.trim(),
      },
    ],
    artifacts: [
      {
        artifact_identity: artifactIdentity,
        target: releaseVersion.target,
        source_sha: releaseVersion.sourceSha,
        marker: (await readFile(markerPath, 'utf8')).trim(),
        files: artifactEntries,
      },
    ],
    scenario_artifact_assignments: scenarioIds.map((scenarioId) => ({ scenario_id: scenarioId, artifact_identity: artifactIdentity })),
    node_specific_builds: [],
  });
}

export async function executeScaleScenario(database, scenario) {
  const provisioningSamples = [];
  const resolutionSamples = [];
  const sovereignControlSamples = [];
  await database.query('begin');
  try {
    await seedSovereignFixtures(database, scenario);
    await seedHostedRealms(database, scenario.generated_nodes);

    for (const node of scenario.generated_nodes) {
      const request = {
        effective_at: scenario.effective_at,
        idempotency_key: `idem:${node.node_id}`,
        mall_id: node.mall_id,
        node_id: node.node_id,
        node_profile: node.node_profile,
        parent_node_id: node.parent_node_id,
        realm_id: node.realm_id,
        requested_by: 'e11-scale-executor',
        signed_level: node.signed_level,
        trace_id: `trace:${node.node_id}`,
      };
      const started = performance.now();
      const result = await database.query('select * from organization.provision_hosted_node($1::jsonb)', [JSON.stringify(request)]);
      provisioningSamples.push({
        node_id: node.node_id,
        elapsed_ms: elapsed(started),
        result: result.rows[0] ?? null,
      });
    }

    for (const node of scenario.generated_nodes) {
      resolutionSamples.push(await resolveNode(database, node));
    }
    for (const control of scenario.sovereign_controls) {
      sovereignControlSamples.push(await resolveNode(database, control));
    }

    const isolation = await collectIsolation(database, scenario, resolutionSamples);
    await database.query('rollback');
    const rollbackRemainingRows = await countRemainingRows(database, scenario.namespace);
    return Object.freeze({
      metrics: {
        scenario_id: scenario.scenario_id,
        scale: scenario.node_count,
        topology_id: scenario.topology_id,
        provisioning_samples: provisioningSamples,
        resolution_samples: resolutionSamples,
        sovereign_control_samples: sovereignControlSamples,
      },
      operations: {
        scenario_id: scenario.scenario_id,
        scale: scenario.node_count,
        topology_id: scenario.topology_id,
        hosted_database_provision_call_count: provisioningSamples.length,
        per_node_infrastructure_events: [],
      },
      isolation: {
        ...isolation,
        rollback_remaining_token_row_count: rollbackRemainingRows,
      },
    });
  } catch (error) {
    await database.query('rollback').catch(() => undefined);
    throw error;
  }
}

function createScenario(topologyId, nodeCount, runToken) {
  const topologyCode = topologyCodes[topologyId];
  if (!topologyCode) throw new Error(`E11_TOPOLOGY_UNKNOWN:${topologyId}`);
  const scaleCode = String(nodeCount).padStart(4, '0');
  const namespace = `e11-${runToken}-${topologyCode}-${scaleCode}`;
  const scenarioId = `scale-${scaleCode}-${topologyId}`;
  const lineCount = topologyId === 'multi-line-horizontal' ? 3 : 1;
  const lines = Array.from({ length: lineCount }, (_, index) => `line:${namespace}:${index + 1}`);
  const roots = lines.map((lineId, index) => {
    const nodeId = `node:${namespace}-r${index + 1}:l0`;
    return fixtureNode({
      nodeId,
      lineId,
      parentNodeId: null,
      signedLevel: 'L0',
      realmId: `realm:${namespace}-r${index + 1}`,
      mallId: `mall:${namespace}:root:${index + 1}`,
      hostSovereignNodeId: nodeId,
      ancestors: [],
    });
  });
  const sovereignControls = Array.from({ length: 3 }, (_, index) => {
    const lineIndex = topologyId === 'multi-line-horizontal' ? index : 0;
    const root = roots[lineIndex];
    const nodeId = `node:${namespace}-s${index + 1}:l1`;
    return fixtureNode({
      nodeId,
      lineId: root.line_id,
      parentNodeId: root.node_id,
      signedLevel: 'L1',
      realmId: `realm:${namespace}-s${index + 1}`,
      mallId: `mall:${namespace}:sovereign:${index + 1}`,
      hostSovereignNodeId: nodeId,
      ancestors: [root.node_id],
    });
  });
  const generatedNodes = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const verticalPosition = index % 10;
    const branch = Math.floor(index / 10);
    const controlIndex = topologyId === 'l0-l11-vertical-mixed' ? branch % 3 : index % 3;
    const control = sovereignControls[controlIndex];
    const level = topologyId === 'l0-l11-vertical-mixed' ? verticalPosition + 2 : 2;
    const prior = topologyId === 'l0-l11-vertical-mixed' && verticalPosition > 0 ? generatedNodes[index - 1] : null;
    const parentNodeId = prior?.node_id ?? control.node_id;
    const ancestors = prior ? [prior.node_id, ...prior.ancestors] : [control.node_id, ...control.ancestors];
    const nodeProfile = index % 2 === 0 ? 'operating_mall' : 'consumer';
    const suffix = String(index + 1).padStart(4, '0');
    const nodeId = `node:${namespace}-n${suffix}:l${level}`;
    generatedNodes.push(
      fixtureNode({
        nodeId,
        lineId: control.line_id,
        parentNodeId,
        signedLevel: `L${level}`,
        realmId: `realm:${namespace}-n${suffix}`,
        mallId: nodeProfile === 'operating_mall' ? `mall:${namespace}:hosted:${suffix}` : null,
        hostSovereignNodeId: control.node_id,
        nodeProfile,
        sovereigntyTier: 'hosted',
        ancestors,
      })
    );
  }
  return Object.freeze({
    scenario_id: scenarioId,
    namespace,
    topology_id: topologyId,
    node_count: nodeCount,
    effective_at: '2026-09-14T00:00:00.000Z',
    lines,
    fixture_roots: roots,
    sovereign_controls: sovereignControls,
    generated_nodes: generatedNodes,
  });
}

function fixtureNode(input) {
  return Object.freeze({
    node_id: input.nodeId,
    line_id: input.lineId,
    parent_node_id: input.parentNodeId,
    signed_level: input.signedLevel,
    sovereignty_tier: input.sovereigntyTier ?? 'sovereign',
    node_profile: input.nodeProfile ?? 'operating_mall',
    realm_id: input.realmId,
    mall_id: input.mallId,
    host_sovereign_node_id: input.hostSovereignNodeId,
    status: 'active',
    relation_version: 1,
    ancestors: input.ancestors,
  });
}

async function seedSovereignFixtures(database, scenario) {
  const fixtures = [...scenario.fixture_roots, ...scenario.sovereign_controls];
  await insertRealms(database, fixtures);
  await database.query(
    `insert into organization.node(
       id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
     )
     select fixture.node_id,fixture.line_id,'sovereign',fixture.node_profile,fixture.realm_id,
       fixture.mall_id,'active',$2::timestamptz,$2::timestamptz
     from jsonb_to_recordset($1::jsonb) fixture(
       node_id text,line_id text,node_profile text,realm_id text,mall_id text
     )`,
    [JSON.stringify(fixtures), scenario.effective_at]
  );
  for (const node of fixtures) {
    await database.query(
      `insert into organization.noderelation(
         line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
         host_sovereign_node_id,relation_version,effective_at
       ) values($1,$2,$3,$3,$4,$5,1,$6::timestamptz)`,
      [node.line_id, node.node_id, node.parent_node_id, node.signed_level, node.host_sovereign_node_id, scenario.effective_at]
    );
  }
}

async function seedHostedRealms(database, nodes) {
  await insertRealms(database, nodes);
}

async function insertRealms(database, nodes) {
  if (nodes.length === 0) return;
  const rows = nodes.map((node) => ({
    id: node.realm_id,
    node_id: node.node_id,
    node_profile: node.node_profile,
    mall_id: node.mall_id,
    host_node_id: node.node_profile === 'consumer' ? node.host_sovereign_node_id : null,
    host_node_profile: node.node_profile === 'consumer' ? 'operating_mall' : null,
  }));
  await database.query(
    `insert into identity.realm(
       id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
     )
     select fixture.id,fixture.node_id,'active',clock_timestamp(),clock_timestamp(),0,
       fixture.node_profile,fixture.mall_id,fixture.host_node_id,fixture.host_node_profile
     from jsonb_to_recordset($1::jsonb) fixture(
       id text,node_id text,node_profile text,mall_id text,host_node_id text,host_node_profile text
     )`,
    [JSON.stringify(rows)]
  );
}

async function resolveNode(database, node) {
  const started = performance.now();
  const result = await database.query(
    `select
       (select row_to_json(context_row) from organization.resolve_node_context($1) context_row) context,
       (select row_to_json(self_row) from organization.resolve_node_scope_self($2,$1) self_row) scope_self,
       coalesce((select json_agg(row_to_json(ancestor_row) order by ancestor_row.distance)
         from organization.resolve_node_scope_ancestors($2,$1) ancestor_row),'[]'::json) ancestors,
       (select row_to_json(capability_row) from(
         select node_id,line_id,capability_version::integer,capabilities,prior_node_profile,
           node_profile,relation_version::integer,source_operation_id
         from organization.nodecapabilityversion where node_id=$1
         order by capability_version desc limit 1
       ) capability_row) capability`,
    [node.node_id, node.line_id]
  );
  return Object.freeze({
    node_id: node.node_id,
    elapsed_ms: elapsed(started),
    context: result.rows[0]?.context ?? null,
    scope_self: result.rows[0]?.scope_self ?? null,
    ancestors: result.rows[0]?.ancestors ?? null,
    capability: result.rows[0]?.capability ?? null,
  });
}

async function collectIsolation(database, scenario, resolutionSamples) {
  const nodeIds = scenario.generated_nodes.map((node) => node.node_id);
  const counts = await database.query(
    `select
       (select count(*)::integer from organization.node where id=any($1::text[]) and sovereignty_tier='hosted') hosted_nodes,
       (select count(*)::integer from organization.hostednodeprovisioning where node_id=any($1::text[])) provisioning_rows,
       (select count(*)::integer from identity.realm where node_id=any($1::text[])) realm_rows,
       (select count(*)::integer from organization.noderelation where node_id=any($1::text[]) and superseded_at is null) current_relation_rows,
       (select count(*)::integer from organization.nodecapabilityversion where node_id=any($1::text[])) capability_rows,
       (select count(*)::integer from organization.nodeclosure where descendant_node_id=any($1::text[]) and superseded_at is null) closure_rows`,
    [nodeIds]
  );
  const [duplicates, crossLineClosure, lineStats, profileCounts, sovereignControls] = await Promise.all([
    database.query(
      `select node_id,count(*)::integer row_count from organization.hostednodeprovisioning
       where node_id=any($1::text[]) group by node_id having count(*)>1 order by node_id`,
      [nodeIds]
    ),
    database.query(
      `select closure.line_id,closure.descendant_node_id,closure.ancestor_node_id,
         descendant.line_id descendant_line_id,ancestor.line_id ancestor_line_id
       from organization.nodeclosure closure
       join organization.node descendant on descendant.id=closure.descendant_node_id
       join organization.node ancestor on ancestor.id=closure.ancestor_node_id
       where closure.descendant_node_id=any($1::text[]) and closure.superseded_at is null
         and (closure.line_id<>descendant.line_id or closure.line_id<>ancestor.line_id)
       order by closure.descendant_node_id,closure.depth`,
      [nodeIds]
    ),
    database.query(
      `select count(distinct node.line_id)::integer distinct_line_count,
         max(substring(relation.signed_level from 2)::integer)::integer maximum_signed_level
       from organization.node node join organization.noderelation relation
         on relation.line_id=node.line_id and relation.node_id=node.id and relation.superseded_at is null
       where node.id=any($1::text[])`,
      [nodeIds]
    ),
    database.query(
      `select node_profile,count(*)::integer row_count from organization.node
       where id=any($1::text[]) group by node_profile order by node_profile`,
      [nodeIds]
    ),
    database.query(
      `select count(*)::integer from organization.node
       where id=any($1::text[]) and sovereignty_tier='sovereign' and status='active'`,
      [scenario.sovereign_controls.map((node) => node.node_id)]
    ),
  ]);
  const crossLineScopeRows = [];
  for (const sample of resolutionSamples) {
    const expected = scenario.generated_nodes.find((node) => node.node_id === sample.node_id);
    for (const row of [sample.scope_self, ...(Array.isArray(sample.ancestors) ? sample.ancestors : [])]) {
      if (row?.line_id !== expected?.line_id) crossLineScopeRows.push({ node_id: sample.node_id, row });
    }
  }
  return Object.freeze({
    scenario_id: scenario.scenario_id,
    scale: scenario.node_count,
    topology_id: scenario.topology_id,
    database_counts: counts.rows[0],
    distinct_line_count: lineStats.rows[0]?.distinct_line_count ?? null,
    maximum_signed_level: lineStats.rows[0]?.maximum_signed_level ?? null,
    profile_counts: profileCounts.rows,
    sovereign_control_count: Number(sovereignControls.rows[0]?.count ?? 0),
    duplicate_node_ids: duplicates.rows,
    cross_line_closure_rows: crossLineClosure.rows,
    cross_line_scope_rows: crossLineScopeRows,
  });
}

async function countRemainingRows(database, namespace) {
  const result = await database.query(
    `select sum(row_count)::integer count from(
       select count(*) row_count from identity.realm where id like $1
       union all select count(*) from organization.node where id like $2
       union all select count(*) from organization.noderelation where node_id like $2
       union all select count(*) from organization.hostednodeprovisioning where node_id like $2
     ) counts`,
    [`realm:${namespace}%`, `node:${namespace}%`]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function collectSourceEntries(directory, scope, output) {
  const names = await readdir(directory, { withFileTypes: true });
  for (const entry of names) {
    if (entry.isDirectory() && scope.excluded_directory_names.includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const repositoryPath = relative(repositoryRoot, path).replaceAll('\\', '/');
    const segments = repositoryPath.split('/');
    if (scope.excluded_path_segments.some((segment) => segments.includes(segment))) continue;
    if (entry.isDirectory()) {
      await collectSourceEntries(path, scope, output);
      continue;
    }
    if (!entry.isFile() || !scope.extensions.includes(extname(entry.name))) continue;
    if (scope.excluded_filename_patterns.some((pattern) => entry.name.includes(pattern))) continue;
    const bytes = await readFile(path);
    output.push(Object.freeze({ path: repositoryPath, size_bytes: bytes.byteLength, sha256: `sha256:${sha256(bytes)}` }));
  }
}

async function collectArtifactEntries(directory) {
  const output = [];
  await collectArtifactDirectory(directory, directory, output);
  output.sort((left, right) => left.path.localeCompare(right.path));
  return output;
}

async function collectArtifactDirectory(root, directory, output) {
  const names = await readdir(directory, { withFileTypes: true });
  for (const entry of names) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectArtifactDirectory(root, path, output);
    else if (entry.isFile()) {
      const bytes = await readFile(path);
      output.push(
        Object.freeze({
          path: relative(root, path).replaceAll('\\', '/'),
          size_bytes: bytes.byteLength,
          sha256: `sha256:${sha256(bytes)}`,
        })
      );
    }
  }
}

function inventoryDigest(entries) {
  return sha256(Buffer.from(entries.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function capture(command, arguments_) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveCapture(stdout);
      else reject(new Error(`COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}:${stderr.trim()}`));
    });
  });
}

function elapsed(started) {
  return Number((performance.now() - started).toFixed(3));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
