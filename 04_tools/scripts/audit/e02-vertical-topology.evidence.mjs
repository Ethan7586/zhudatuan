export function createVerticalFixture(criteria, runToken) {
  const lineId = `line:e02-${runToken}:vertical`;
  const nodes = Array.from({ length: criteria.fixture.node_count }, (_, level) => {
    const profile = level <= 5 ? 'operating_mall' : 'consumer';
    return Object.freeze({
      fixture_id: `V-L${level}`,
      level,
      signed_level: `L${level}`,
      node_id: `node:e02-${runToken}:l${level}`,
      realm_id: `realm:e02-${runToken}-l${level}`,
      line_id: lineId,
      parent_node_id: level === 0 ? null : `node:e02-${runToken}:l${level - 1}`,
      original_parent_node_id: level === 0 ? null : `node:e02-${runToken}:l${level - 1}`,
      sovereignty_tier: level <= 1 ? 'sovereign' : 'hosted',
      node_profile: profile,
      mall_id: profile === 'operating_mall' ? `mall:e02-${runToken}:l${level}` : null,
      host_sovereign_node_id: level === 0 ? `node:e02-${runToken}:l0` : `node:e02-${runToken}:l1`,
    });
  });
  return Object.freeze({
    schema_version: 'e02-vertical-input-manifest-v1',
    captured_at: new Date().toISOString(),
    run_token: runToken,
    line_id: lineId,
    initial_effective_at: criteria.fixture.initial_effective_at,
    changed_effective_at: criteria.fixture.changed_effective_at,
    nodes,
  });
}

export async function executeVerticalTopology(database, criteria, fixture) {
  const nodeIds = fixture.nodes.map((node) => node.node_id);
  const realmIds = fixture.nodes.map((node) => node.realm_id);
  const target = fixture.nodes.find((node) => node.fixture_id === criteria.fixture.relation_version_target);
  if (!target) throw new Error('E02_RELATION_VERSION_TARGET_MISSING');
  const modelPath = await collectModelPath(database);
  await database.query('begin');
  try {
    await seedRealmsAndNodes(database, fixture);
    const authorityBeforeRelations = await collectAuthority(database, nodeIds, realmIds);
    for (const node of fixture.nodes) await insertRelation(database, node, fixture.initial_effective_at, 1);

    const initialRelations = await collectRelations(database, fixture.line_id);
    const initialClosure = await collectClosure(database, fixture.line_id);
    const initialContexts = await collectContexts(database, fixture.nodes);
    const initialResolvers = await collectResolvers(database, fixture.nodes);
    const authorityAfterInitialRelations = await collectAuthority(database, nodeIds, realmIds);

    await database.query(`update organization.noderelation set superseded_at=$1::timestamptz
      where line_id=$2 and node_id=$3 and relation_version=1`,
    [fixture.changed_effective_at, fixture.line_id, target.node_id]);
    await insertRelation(database, target, fixture.changed_effective_at, 2);

    const finalRelations = await collectRelations(database, fixture.line_id);
    const currentClosure = await collectClosure(database, fixture.line_id);
    const historicalClosure = await collectHistoricalClosure(database, fixture.line_id);
    const currentContexts = await collectContexts(database, fixture.nodes);
    const currentResolvers = await collectResolvers(database, fixture.nodes);
    const historicalPath = await relationPathAt(database, fixture.line_id, target.node_id, '2026-09-14T00:30:00.000Z');
    const currentPath = await relationPathAt(database, fixture.line_id, target.node_id, fixture.changed_effective_at);
    const negativeProbes = await executeNegativeProbes(database, fixture);
    const authorityAfterVersion = await collectAuthority(database, nodeIds, realmIds);
    const l12FactCount = await scalar(database, `select
      (select count(*) from organization.noderelation where line_id=$1 and signed_level='L12')
      +(select count(*) from organization.node where line_id=$1 and id like '%:l12')`, [fixture.line_id]);

    await database.query('rollback');
    const rollback = await collectRollback(database, fixture);
    return Object.freeze({
      input: fixture,
      relations: Object.freeze({
        schema_version: 'e02-vertical-node-relations-v1',
        captured_at: new Date().toISOString(),
        initial: initialRelations,
        after_version_change: finalRelations,
      }),
      contexts: Object.freeze({
        schema_version: 'e02-vertical-context-matrix-v1',
        captured_at: new Date().toISOString(),
        shared_resolver: 'organization.resolve_node_context(text)',
        before_version_change: initialContexts,
        after_version_change: currentContexts,
      }),
      closure: Object.freeze({
        schema_version: 'e02-vertical-closure-matrix-v1',
        captured_at: new Date().toISOString(),
        initial_current_rows: initialClosure,
        after_version_current_rows: currentClosure,
        after_version_historical_rows: historicalClosure,
        resolver_functions: {
          self: 'organization.resolve_node_scope_self(text,text)',
          ancestors: 'organization.resolve_node_scope_ancestors(text,text)',
          descendants: 'organization.resolve_node_scope_descendants(text,text)',
          subtree: 'organization.resolve_node_scope_subtree(text,text)',
        },
        before_version_resolver_results: initialResolvers,
        after_version_resolver_results: currentResolvers,
      }),
      version: Object.freeze({
        schema_version: 'e02-vertical-relation-version-diff-v1',
        captured_at: new Date().toISOString(),
        target_fixture_id: target.fixture_id,
        target_node_id: target.node_id,
        relation_rows: finalRelations.filter((row) => row.node_id === target.node_id),
        historical_path: historicalPath,
        current_path: currentPath,
      }),
      negatives: Object.freeze({
        schema_version: 'e02-vertical-negative-probes-v1',
        captured_at: new Date().toISOString(),
        probes: negativeProbes.probes,
        accepted_probe_count: negativeProbes.probes.filter((probe) => probe.accepted).length,
        residual_fact_count: negativeProbes.residual_fact_count,
        l12_fact_count: Number(l12FactCount),
        rollback,
      }),
      authority: Object.freeze({
        schema_version: 'e02-vertical-authority-counters-v1',
        captured_at: new Date().toISOString(),
        comparison_levels: ['L2', 'L11'],
        before_relations: authorityBeforeRelations,
        after_initial_relations: authorityAfterInitialRelations,
        after_relation_version: authorityAfterVersion,
        signed_level_only_permission_change_count: permissionDelta(authorityBeforeRelations, authorityAfterVersion),
        signed_level_only_sovereignty_change_count: sovereigntyDelta(authorityBeforeRelations, authorityAfterVersion),
        signed_level_only_sovereign_resource_change_count: resourceDelta(authorityBeforeRelations, authorityAfterVersion),
        model_and_path: modelPath,
      }),
      execution_summary: Object.freeze({
        node_count: fixture.nodes.length,
        initial_relation_row_count: initialRelations.length,
        final_relation_row_count: finalRelations.length,
        initial_closure_row_count: initialClosure.length,
        current_closure_row_count: currentClosure.length,
        historical_closure_row_count: historicalClosure.length,
        context_observation_count: currentContexts.length,
        resolver_level_count: currentResolvers.length,
        negative_probe_count: negativeProbes.probes.length,
        rollback_remaining_fact_count: rollback.total,
      }),
    });
  } catch (error) {
    await database.query('rollback').catch(() => undefined);
    throw error;
  }
}

async function seedRealmsAndNodes(database, fixture) {
  for (const node of fixture.nodes) {
    await database.query(`insert into identity.realm(
      id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
    ) values($1,$2,'active',$3::timestamptz,$3::timestamptz,0,$4,$5,$6,$7)`, [
      node.realm_id,
      node.node_id,
      fixture.initial_effective_at,
      node.node_profile,
      node.mall_id,
      node.node_profile === 'consumer' ? node.host_sovereign_node_id : null,
      node.node_profile === 'consumer' ? 'operating_mall' : null,
    ]);
    await database.query(`insert into organization.node(
      id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
    ) values($1,$2,$3,$4,$5,$6,'active',$7::timestamptz,$7::timestamptz)`, [
      node.node_id,
      node.line_id,
      node.sovereignty_tier,
      node.node_profile,
      node.realm_id,
      node.mall_id,
      fixture.initial_effective_at,
    ]);
  }
}

function insertRelation(database, node, effectiveAt, version) {
  return database.query(`insert into organization.noderelation(
    line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
    relation_version,effective_at
  ) values($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)`, [
    node.line_id,
    node.node_id,
    node.parent_node_id,
    node.original_parent_node_id,
    node.signed_level,
    node.host_sovereign_node_id,
    version,
    effectiveAt,
  ]);
}

async function collectRelations(database, lineId) {
  return rows(database, `select line_id,node_id,parent_node_id,original_parent_node_id,signed_level,
    host_sovereign_node_id,relation_version::integer,
    to_char(effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') effective_at,
    case when superseded_at is null then null else
      to_char(superseded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end superseded_at
    from organization.noderelation where line_id=$1 order by node_id,relation_version`, [lineId]);
}

async function collectClosure(database, lineId) {
  return rows(database, `select line_id,descendant_node_id,ancestor_node_id,depth,
    descendant_relation_version::integer,
    to_char(effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') effective_at
    from organization.nodeclosure where line_id=$1 and superseded_at is null
    order by descendant_node_id,depth,ancestor_node_id`, [lineId]);
}

async function collectHistoricalClosure(database, lineId) {
  return rows(database, `select line_id,descendant_node_id,ancestor_node_id,depth,
    descendant_relation_version::integer,
    to_char(effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') effective_at,
    to_char(superseded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') superseded_at
    from organization.nodeclosure where line_id=$1 and superseded_at is not null
    order by descendant_node_id,effective_at,depth,ancestor_node_id`, [lineId]);
}

async function collectContexts(database, nodes) {
  const output = [];
  for (const node of nodes) {
    const result = await database.query('select * from organization.resolve_node_context($1)', [node.node_id]);
    output.push(Object.freeze({ fixture_id: node.fixture_id, level: node.level, context: result.rows[0] ?? null }));
  }
  return output;
}

async function collectResolvers(database, nodes) {
  const functions = {
    self: 'resolve_node_scope_self',
    ancestors: 'resolve_node_scope_ancestors',
    descendants: 'resolve_node_scope_descendants',
    subtree: 'resolve_node_scope_subtree',
  };
  const output = [];
  for (const node of nodes) {
    const result = { fixture_id: node.fixture_id, level: node.level, node_id: node.node_id };
    for (const [operation, functionName] of Object.entries(functions)) {
      result[operation] = await rows(database,
        `select node_id,distance,relation_version,effective_at,status
         from organization.${functionName}($1,$2) order by distance,node_id`, [node.line_id, node.node_id]);
    }
    output.push(Object.freeze(result));
  }
  return output;
}

async function relationPathAt(database, lineId, nodeId, at) {
  return rows(database, `with recursive path(node_id,distance) as(
      select $2::text,0
      union all
      select relation.parent_node_id,path.distance+1
      from path
      join organization.noderelation relation on relation.line_id=$1 and relation.node_id=path.node_id
        and relation.effective_at<=$3::timestamptz
        and (relation.superseded_at is null or $3::timestamptz<relation.superseded_at)
      where relation.parent_node_id is not null
    )
    select path.node_id,path.distance,relation.signed_level,relation.relation_version::integer
    from path
    join organization.noderelation relation on relation.line_id=$1 and relation.node_id=path.node_id
      and relation.effective_at<=$3::timestamptz
      and (relation.superseded_at is null or $3::timestamptz<relation.superseded_at)
    order by path.distance`, [lineId, nodeId, at]);
}

async function executeNegativeProbes(database, fixture) {
  const l1 = fixture.nodes[1];
  const probes = [];
  probes.push(await rejectedProbe(database, 'skip-level', async () => {
    const node = probeNode(fixture, 'skip', 8, fixture.nodes[6].node_id, l1.node_id);
    await insertProbeNode(database, node, fixture.initial_effective_at);
    await insertRelation(database, node, fixture.changed_effective_at, 1);
  }));
  probes.push(await rejectedProbe(database, 'second-current-parent', async () => {
    const node = fixture.nodes[7];
    await insertRelation(database, node, fixture.changed_effective_at, 2);
  }));
  probes.push(await rejectedProbe(database, 'cross-line', async () => {
    const foreign = probeNode(fixture, 'foreign-root', 0, null, null, `line:e02-${fixture.run_token}:foreign`, 'sovereign');
    foreign.host_sovereign_node_id = foreign.node_id;
    await insertProbeNode(database, foreign, fixture.initial_effective_at);
    await insertRelation(database, foreign, fixture.initial_effective_at, 1);
    const child = probeNode(fixture, 'cross-line-child', 7, foreign.node_id, l1.node_id);
    await insertProbeNode(database, child, fixture.initial_effective_at);
    await insertRelation(database, child, fixture.changed_effective_at, 1);
  }));
  probes.push(await rejectedProbe(database, 'l12-boundary', async () => {
    const node = probeNode(fixture, 'l12', 12, fixture.nodes[11].node_id, l1.node_id);
    await insertProbeNode(database, node, fixture.initial_effective_at);
    await insertRelation(database, node, fixture.changed_effective_at, 1);
  }));
  const residual = await database.query(`select
    (select count(*)::integer from identity.realm where id like $1) realms,
    (select count(*)::integer from organization.node where id like $2) nodes,
    (select count(*)::integer from organization.noderelation where node_id like $2) relations`,
  [`realm:e02-${fixture.run_token}-probe-%`, `node:e02-${fixture.run_token}-probe-%`]);
  const counts = residual.rows[0];
  return Object.freeze({
    probes,
    residual_fact_count: Number(counts.realms) + Number(counts.nodes) + Number(counts.relations),
  });
}

async function rejectedProbe(database, probeId, operation) {
  const savepoint = `e02_probe_${probeId.replaceAll('-', '_')}`;
  await database.query(`savepoint ${savepoint}`);
  let accepted = true;
  let error = null;
  try {
    await operation();
  } catch (cause) {
    accepted = false;
    error = { message: cause instanceof Error ? cause.message : String(cause), code: cause?.code ?? null };
  }
  await database.query(`rollback to savepoint ${savepoint}`);
  await database.query(`release savepoint ${savepoint}`);
  return Object.freeze({ probe_id: probeId, accepted, error });
}

function probeNode(fixture, label, level, parentNodeId, hostNodeId, lineId = fixture.line_id, tier = 'hosted') {
  const profile = level === 0 ? 'operating_mall' : 'consumer';
  return {
    fixture_id: `PROBE-${label}`,
    level,
    signed_level: `L${level}`,
    node_id: `node:e02-${fixture.run_token}-probe-${label}:l${level}`,
    realm_id: `realm:e02-${fixture.run_token}-probe-${label}-l${level}`,
    line_id: lineId,
    parent_node_id: parentNodeId,
    original_parent_node_id: parentNodeId,
    sovereignty_tier: tier,
    node_profile: profile,
    mall_id: profile === 'operating_mall' ? `mall:e02-${fixture.run_token}:probe:${label}` : null,
    host_sovereign_node_id: hostNodeId,
  };
}

async function insertProbeNode(database, node, effectiveAt) {
  await database.query(`insert into identity.realm(
    id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
  ) values($1,$2,'active',$3::timestamptz,$3::timestamptz,0,$4,$5,$6,$7)`, [
    node.realm_id,
    node.node_id,
    effectiveAt,
    node.node_profile,
    node.mall_id,
    node.node_profile === 'consumer' ? node.host_sovereign_node_id : null,
    node.node_profile === 'consumer' ? 'operating_mall' : null,
  ]);
  await database.query(`insert into organization.node(
    id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
  ) values($1,$2,$3,$4,$5,$6,'active',$7::timestamptz,$7::timestamptz)`, [
    node.node_id,
    node.line_id,
    node.sovereignty_tier,
    node.node_profile,
    node.realm_id,
    node.mall_id,
    effectiveAt,
  ]);
}

async function collectAuthority(database, nodeIds, realmIds) {
  const counts = await database.query(`select
    (select count(*)::integer from access.membership where realm_id=any($2::text[])) memberships,
    (select count(*)::integer from access.membershiprole role_link join access.membership membership
      on membership.id=role_link.membership_id where membership.realm_id=any($2::text[])) membership_roles,
    (select count(*)::integer from access.membershipoverride override_link join access.membership membership
      on membership.id=override_link.membership_id where membership.realm_id=any($2::text[])) permission_overrides,
    (select count(*)::integer from access.scopegrant scope join access.membership membership
      on membership.id=scope.membership_id where membership.realm_id=any($2::text[])) scope_grants,
    (select count(*)::integer from capability.entitlement where scope_id=any($1::text[])) entitlements,
    (select count(*)::integer from organization.domainbindingset where node_id=any($1::text[])) domain_binding_sets,
    (select count(*)::integer from organization.noderesourcebindingset where node_id=any($1::text[])) resource_binding_sets,
    (select count(*)::integer from organization.nodemanifestversion where node_id=any($1::text[])) manifest_versions`,
  [nodeIds, realmIds]);
  const sovereignty = await rows(database, `select id node_id,sovereignty_tier,node_profile
    from organization.node where id=any($1::text[]) order by id`, [nodeIds]);
  const comparison = await rows(database, `select relation.signed_level,node.id node_id,node.sovereignty_tier,
    (select count(*)::integer from capability.entitlement entitlement where entitlement.scope_id=node.id) entitlement_count,
    (select count(*)::integer from organization.noderesourcebindingset resource where resource.node_id=node.id) resource_count,
    (select count(*)::integer from organization.nodemanifestversion manifest where manifest.node_id=node.id) manifest_count
    from organization.node node
    left join organization.noderelation relation on relation.node_id=node.id and relation.line_id=node.line_id
      and relation.superseded_at is null
    where node.id=any($1::text[]) and (relation.signed_level in('L2','L11') or relation.signed_level is null)
    order by node.id`, [nodeIds]);
  return Object.freeze({ ...counts.rows[0], sovereignty, comparison });
}

async function collectModelPath(database) {
  const tables = await rows(database, `select table_schema,table_name
    from information_schema.tables where table_schema='organization'
      and table_name in('node','noderelation','nodeclosure') order by table_name`);
  const resolvers = await rows(database, `select n.nspname schema_name,p.proname function_name,
      pg_get_function_identity_arguments(p.oid) arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='organization' and p.proname in(
      'resolve_node_context','resolve_node_scope_self','resolve_node_scope_ancestors',
      'resolve_node_scope_descendants','resolve_node_scope_subtree') order by p.proname`);
  const levelSpecific = await rows(database, `select table_schema,table_name,column_name
    from information_schema.columns where table_schema='organization'
      and (table_name~'^l([0-9]|10|11)_' or column_name~'^l([0-9]|10|11)_')
    order by table_name,column_name`);
  return Object.freeze({ tables, resolvers, level_specific_tables_or_columns: levelSpecific });
}

async function collectRollback(database, fixture) {
  const result = await database.query(`select
    (select count(*)::integer from identity.realm where id like $1) realms,
    (select count(*)::integer from organization.node where line_id=$2) nodes,
    (select count(*)::integer from organization.noderelation where line_id=$2) relations,
    (select count(*)::integer from organization.nodeclosure where line_id=$2) closure_rows`,
  [`realm:e02-${fixture.run_token}-%`, fixture.line_id]);
  const value = result.rows[0];
  return Object.freeze({ ...value, total: Object.values(value).reduce((sum, count) => sum + Number(count), 0) });
}

function permissionDelta(before, after) {
  return ['memberships', 'membership_roles', 'permission_overrides', 'scope_grants', 'entitlements']
    .reduce((total, key) => total + Math.abs(Number(after[key]) - Number(before[key])), 0);
}

function sovereigntyDelta(before, after) {
  return JSON.stringify(before.sovereignty) === JSON.stringify(after.sovereignty) ? 0 : 1;
}

function resourceDelta(before, after) {
  return ['domain_binding_sets', 'resource_binding_sets', 'manifest_versions']
    .reduce((total, key) => total + Math.abs(Number(after[key]) - Number(before[key])), 0);
}

async function rows(database, sql, parameters = []) {
  return (await database.query(sql, parameters)).rows;
}

async function scalar(database, sql, parameters = []) {
  const result = await database.query(sql, parameters);
  return Object.values(result.rows[0] ?? {})[0];
}
