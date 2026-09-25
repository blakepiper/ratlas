import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configArguments, loadConfig } from '../apps/service/src/commands/config.js';
import { prepareDatabase } from '../apps/service/src/commands/prepare.js';
import { catalogQuerySchema } from '../packages/core/dist/index.js';
import {
  openReader,
  openWriter,
  migrate,
  generateSmallDemo,
  DEMO_REFERENCE,
  demoIdentities,
  defaultQuery,
  publicSummary,
  catalog,
  repoDetail,
  relationships,
  sources,
  filterSql,
  beginSnapshot,
  stageSnapshot,
  finishSnapshot,
  recordGap,
} from '../packages/db/dist/index.js';
const config = loadConfig(configArguments().config);
if (config.mode === 'demo') prepareDatabase(config);
const directory = resolve('.ratlas/reviews/R2');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const db = openReader(config.storage.databasePath);
try {
  const query = defaultQuery(),
    counts = publicSummary(db, query),
    list = catalog(db, query);
  const rid = config.mode === 'demo' ? demoIdentities().rids[0] : list.items[0]?.rid;
  const detail = rid ? repoDetail(db, rid, query, config) : null,
    edges = rid ? relationships(db, query, rid) : [];
  const missing = catalog(db, catalogQuerySchema.parse({ metadata: 'unresolved', limit: '1' }))
    .items[0];
  const disagreements = relationships(db, query).filter((edge) => edge.sourcesDisagree);
  const lines = [
    '# ratlas R2 data review',
    '',
    `Dataset: **${counts.mode === 'demo' ? 'synthetic demo; no live collection' : 'stored live observations; this report does not contact sources'}**.`,
    `Reference time: ${counts.referenceTime}. Window: ${counts.observationWindow}. Projection revision: ${counts.datasetRevision}.`,
    '',
    '| Public measure | Count |',
    '| --- | ---: |',
    `| Unique RIDs | ${counts.repositories} |`,
    `| Node identities | ${counts.nodeIdentities} |`,
    `| Distinct RID/NID hosting relationships | ${counts.hostingRelationships} |`,
    `| Evidence sources | ${counts.evidenceSources} |`,
    `| Unresolved names | ${counts.unresolvedMetadata} |`,
    '',
    '## Provenance and deduplication',
    '',
    detail
      ? `Repository: ${detail.name ?? 'Name unresolved'} — \`${rid}\`.`
      : 'No eligible repository available.',
    `The selected repository has **${edges.length} distinct seeders** backed by **${edges.reduce((sum, edge) => sum + edge.evidence.length, 0)} source-specific relationship records**.`,
    '',
  ];
  for (const edge of edges) {
    lines.push(`- Subject NID: \`${edge.nid}\`.`);
    for (const evidence of edge.evidence)
      lines.push(
        `  - ${evidence.sourceId}: ${evidence.state}; source read ${evidence.lastObservedAt}; announcement ${evidence.announcedAt ?? 'unavailable'}; observer ${evidence.observerNid ?? 'unknown'}.`,
      );
  }
  lines.push(
    '',
    `Source-state disagreements across the current dataset: **${disagreements.length}**. One source dropping a relationship does not override another positive source.`,
    `Missing metadata example: ${missing ? '`' + missing.rid + '` — still usable by exact RID.' : 'none in current projection.'}`,
    '',
    '## Source health',
    '',
  );
  for (const source of sources(db))
    lines.push(
      `- ${source.label} (${source.adapter}): ${source.error ?? 'no recorded error'}; last complete snapshot ${source.lastCompleteSnapshot ?? 'not recorded'}; partial/failed runs ${source.partialRuns}.`,
    );
  // Failure proof uses a separate synthetic database; never alter the reviewed/live dataset.
  const fixture = openWriter(resolve(mkdtempSync(directory + '/failure-'), 'ratlas.sqlite'));
  try {
    migrate(fixture.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    generateSmallDemo(fixture.db);
    const before = publicSummary(fixture.db, query);
    beginSnapshot(fixture.db, 'review-failure', 'demo-a', DEMO_REFERENCE);
    stageSnapshot(fixture.db, 'review-failure', [
      { rid: demoIdentities().rids[0], nid: demoIdentities().nids[0] },
    ]);
    finishSnapshot(fixture.db, 'review-failure', DEMO_REFERENCE, 'failure');
    recordGap(fixture.db, 'demo-a', DEMO_REFERENCE, 'snapshot-failure');
    const after = publicSummary(fixture.db, query);
    lines.push(
      '',
      '## Failure preserving cached data',
      '',
      `Separate deterministic fixture: a snapshot stops after one staged row. Before: ${before.repositories} RIDs / ${before.hostingRelationships} relationships. After failure: ${after.repositories} RIDs / ${after.hostingRelationships} relationships. Source A reports a gap; public cached data remains. No live node was interrupted.`,
    );
  } finally {
    fixture.close();
  }
  const { sql, parameters } = filterSql(db, query);
  const plans = {
    catalog: db
      .prepare(
        'EXPLAIN QUERY PLAN ' +
          sql +
          ' SELECT * FROM filtered_repos ORDER BY COALESCE(name,rid),rid LIMIT 50',
      )
      .all(parameters),
    exactRid: db
      .prepare('EXPLAIN QUERY PLAN ' + sql + ' SELECT * FROM filtered_repos WHERE rid=$rid')
      .all({ ...parameters, rid: rid ?? '' }),
    repoNeighborhood: db
      .prepare('EXPLAIN QUERY PLAN ' + sql + ' SELECT * FROM filtered_routes WHERE rid=$rid')
      .all({ ...parameters, rid: rid ?? '' }),
    nodeNeighborhood: db
      .prepare('EXPLAIN QUERY PLAN ' + sql + ' SELECT * FROM filtered_routes WHERE nid=$nid')
      .all({ ...parameters, nid: edges[0]?.nid ?? '' }),
  };
  writeFileSync(directory + '/query-plans.json', JSON.stringify(plans, null, 2) + '\n', {
    mode: 0o600,
  });
  lines.push(
    '',
    '## Limits',
    '',
    counts.coverage.limitations,
    'This report performs no live probes. It reads the configured database and runs a separate deterministic failure fixture. Deployed-source compatibility must be checked separately; see docs/RADICLE_COMPATIBILITY.md.',
    'Query plans: `.ratlas/reviews/R2/query-plans.json`.',
  );
  const report = lines.join('\n') + '\n';
  writeFileSync(directory + '/data-review.md', report, { mode: 0o600 });
  console.log(report);
} finally {
  db.close();
}
