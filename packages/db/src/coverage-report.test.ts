import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema, syntheticRid, syntheticNid } from '@ratlas/core';
import { openWriter, migrate } from './connection.js';
import { registerSource, observe, storeMetadata } from './observations.js';
import { coverageReport, referenceCompleteness } from './coverage-report.js';
import { admitCandidate } from './candidates.js';

it('reports source overlap, multi-host topology, metadata-only and quarantine separately', () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const writer = openWriter(resolve(mkdtempSync('.ratlas/tests/coverage-'), 'data.sqlite'));
  const now = Date.UTC(2026, 8, 29, 12);
  const rid = (n: number) => syntheticRid(new Uint8Array(20).fill(n));
  const nid = (n: number) => syntheticNid(new Uint8Array(32).fill(n));
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: 'private/path/should/not/appear.sqlite' },
  });
  try {
    migrate(writer.db, 'live', now);
    for (const id of ['a', 'b', 'hidden'])
      registerSource(
        writer.db,
        sourceSchema.parse({
          id,
          label: id,
          adapter: 'http',
          policy: id === 'hidden' ? 'quarantine' : 'public-http',
        }),
      );
    for (const [sourceId, r, n] of [
      ['a', 1, 1],
      ['b', 1, 1],
      ['b', 1, 2],
      ['a', 2, 1],
      ['hidden', 9, 9],
    ] as const)
      observe(writer.db, {
        id: sourceId + r + n,
        sourceId,
        rid: rid(r),
        nid: nid(n),
        kind: 'present',
        observedAt: now,
      });
    observe(writer.db, {
      id: 'old',
      sourceId: 'a',
      rid: rid(4),
      nid: nid(4),
      kind: 'present',
      observedAt: now - 8 * 86400000,
    });
    for (const r of [1, 3])
      storeMetadata(writer.db, {
        rid: rid(r),
        sourceId: 'a',
        retrievedAt: now,
        visibility: 'public',
        name: 'Fixture ' + r,
        description: null,
        branch: null,
        delegates: [],
        revision: null,
      });
    admitCandidate(writer.db, nid(7), 'a', 'reviewed-seed', now);
    const report = coverageReport(writer.db, config, now, 'tested-revision');
    expect(report.windows[0]).toMatchObject({
      hostingRepositories: 2,
      subjectNodes: 2,
      hostingPairs: 3,
      multiHostRepositories: 1,
      metadataOnly: 1,
      header: { repositories: 3, hostingRelationships: 3 },
      metadata: { usableNames: 1, namePercent: 50 },
    });
    expect(report.windows[0]!.contribution.find((s) => s.sourceId === 'a')).toMatchObject({
      uniqueRepositories: 1,
      overlappingRepositories: 1,
      uniqueHostingPairs: 1,
    });
    expect(report.windows[0]!.topology).toMatchObject({
      connectedComponents: 1,
      largestComponentVertices: 4,
      isolatedMetadataOnly: 1,
    });
    expect(report.windows[2]!.hostingPairs).toBe(4);
    expect(report.quarantine.repositories).toBe(1);
    expect(report.candidates.publicSubjects).toBe(1);
    const json = JSON.stringify(report);
    expect(json).not.toContain(rid(9));
    expect(json).not.toContain(nid(9));
    expect(json).not.toContain('private/path');
    expect(
      report.sourceCohort.every((s) => s.referenceCompleteness.catalog.status === 'unknown'),
    ).toBe(true);
    expect(report.collector.state).toBe('never-started');
    for (const [id, started, status] of [
      ['older', now - 1000, 'complete'],
      ['latest', now, 'complete'],
    ] as const)
      writer.db
        .prepare(
          "INSERT INTO reference_enumerations(id,source_id,kind,observer_nid,schema_version,started_at,ended_at,status,pages) VALUES (?,'a','catalog',?,'fixture',?,?,?,1)",
        )
        .run(id, nid(1), started, started + 1, status);
    writer.db.prepare('INSERT INTO reference_members VALUES (?, ?, ?)').run('older', rid(2), null);
    const hash = (
      writer.db
        .prepare("SELECT content_hash FROM repository_metadata WHERE source_id='a' AND rid=?")
        .get(rid(1)) as { content_hash: string }
    ).content_hash;
    writer.db.prepare('INSERT INTO reference_members VALUES (?, ?, ?)').run('latest', rid(1), hash);
    writer.db.prepare('INSERT INTO reference_members VALUES (?, ?, ?)').run('latest', rid(2), null);
    expect(referenceCompleteness(writer.db, 'a', 'catalog')).toMatchObject({
      status: 'unstable-reference',
      denominator: null,
      ingested: 1,
      percent: null,
      metadataPercent: null,
      consecutiveDifference: { added: 1, removed: 0 },
      stability: 'changed',
      omissions: { unavailableOrPending: 1 },
    });
    writer.db.prepare('INSERT INTO reference_members VALUES (?, ?, ?)').run('older', rid(1), hash);
    expect(referenceCompleteness(writer.db, 'a', 'catalog')).toMatchObject({
      status: 'bounded-reference',
      denominator: 2,
      percent: 50,
      metadataPercent: 50,
      stability: 'same bounded set',
    });
    writer.db.prepare("UPDATE reference_enumerations SET status='partial' WHERE id='latest'").run();
    expect(referenceCompleteness(writer.db, 'a', 'catalog')).toMatchObject({
      status: 'partial',
      denominator: null,
      percent: null,
      metadataPercent: null,
      sampledMembers: 2,
    });
  } finally {
    writer.close();
  }
});
