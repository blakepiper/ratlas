import { createHash } from 'node:crypto';
import { windowStart, type Config, type ObservationWindow } from '@ratlas/core';
import type { Db } from './connection.js';
import { dataset, referenceTime } from './queries.js';
import { publicSummary, defaultQuery, sources } from './public.js';

function count(db: Db, sql: string, ...values: (string | number)[]) {
  return (db.prepare(sql).get(...values) as { count: number }).count;
}
function degrees(values: number[]) {
  const histogram: Record<string, number> = {};
  for (const degree of values) histogram[degree] = (histogram[degree] ?? 0) + 1;
  return { histogram, maximum: Math.max(0, ...values), entities: values.length };
}
function windowReport(db: Db, window: ObservationWindow, now: number) {
  const params = { all: Number(window === 'all'), since: windowStart(window, now) };
  const routeSql = `SELECT DISTINCT rid,nid,source_id FROM eligible_routes WHERE ($all=1 OR (state='present' AND last_positive_at >= $since))`;
  const rows = db.prepare(routeSql).all(params) as {
    rid: string;
    nid: string;
    source_id: string;
  }[];
  const repos = new Set<string>(),
    nodes = new Set<string>(),
    pairs = new Map<string, { rid: string; nid: string; sources: Set<string> }>();
  const bySource = new Map<
    string,
    { repos: Set<string>; nodes: Set<string>; pairs: Set<string> }
  >();
  for (const r of rows) {
    repos.add(r.rid);
    nodes.add(r.nid);
    const key = JSON.stringify([r.rid, r.nid]);
    const pair = pairs.get(key) ?? { ...r, sources: new Set<string>() };
    pair.sources.add(r.source_id);
    pairs.set(key, pair);
    const source = bySource.get(r.source_id) ?? {
      repos: new Set<string>(),
      nodes: new Set<string>(),
      pairs: new Set<string>(),
    };
    source.repos.add(r.rid);
    source.nodes.add(r.nid);
    source.pairs.add(key);
    bySource.set(r.source_id, source);
  }
  const repoDegree = new Map<string, number>(),
    nodeRepos = new Map<string, string[]>();
  const parent = new Map<string, string>();
  function root(id: string): string {
    let current = id;
    while (parent.get(current) && parent.get(current) !== current) current = parent.get(current)!;
    parent.set(id, current);
    return current;
  }
  for (const p of pairs.values()) {
    repoDegree.set(p.rid, (repoDegree.get(p.rid) ?? 0) + 1);
    const hosted = nodeRepos.get(p.nid) ?? [];
    hosted.push(p.rid);
    nodeRepos.set(p.nid, hosted);
    parent.set(root('repo:' + p.rid), root('node:' + p.nid));
  }
  const componentSizes = new Map<string, number>();
  for (const id of parent.keys()) {
    const component = root(id);
    componentSizes.set(component, (componentSizes.get(component) ?? 0) + 1);
  }
  const publicRepos = db
    .prepare('SELECT rid FROM public_repositories WHERE $all=1 OR last_observed_at >= $since')
    .all(params) as { rid: string }[];
  const metadataOnly = publicRepos.filter((r) => !repos.has(r.rid)).length;
  const metadata = db
    .prepare(
      `SELECT m.rid,m.name,m.description FROM selected_metadata m WHERE m.rid IN (SELECT DISTINCT rid FROM (${routeSql}))`,
    )
    .all(params) as { rid: string; name: string | null; description: string | null }[];
  const names = metadata.filter((m) => !!m.name?.trim()).length;
  const withDescriptions = metadata.filter((m) => !!m.description?.trim()).length;
  const contribution = [...bySource]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, s]) => {
      const others = [...bySource].filter(([other]) => other !== id).map(([, s]) => s);
      const uniqueRids = [...s.repos].filter((rid) => !others.some((o) => o.repos.has(rid))).length;
      const uniqueNodes = [...s.nodes].filter(
        (nid) => !others.some((o) => o.nodes.has(nid)),
      ).length;
      const uniquePairs = [...s.pairs].filter((key) => pairs.get(key)!.sources.size === 1).length;
      return {
        sourceId: id,
        repositories: s.repos.size,
        subjectNodes: s.nodes.size,
        hostingPairs: s.pairs.size,
        uniqueRepositories: uniqueRids,
        overlappingRepositories: s.repos.size - uniqueRids,
        uniqueSubjectNodes: uniqueNodes,
        uniqueHostingPairs: uniquePairs,
      };
    });
  const journeys = [...nodeRepos]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, r]) => r.length > 1)
    .flatMap(([nid, r]) =>
      r
        .slice(0, 4)
        .map((rid, i) => ({ fromRid: rid, subjectNid: nid, toRid: r[(i + 1) % r.length]! })),
    )
    .slice(0, 20);
  const summary = publicSummary(db, defaultQuery(window), now);
  return {
    window,
    header: {
      repositories: summary.repositories,
      nodeIdentities: summary.nodeIdentities,
      hostingRelationships: summary.hostingRelationships,
      evidenceSources: summary.evidenceSources,
    },
    hostingRepositories: repos.size,
    subjectNodes: nodes.size,
    hostingPairs: pairs.size,
    metadataOnly,
    multiHostRepositories: [...repoDegree.values()].filter((d) => d >= 2).length,
    metadata: {
      usableNames: names,
      namePercent: repos.size ? (100 * names) / repos.size : null,
      missingNames: repos.size - names,
      missingDescriptions: repos.size - withDescriptions,
      unavailable: repos.size - metadata.length,
    },
    contribution,
    topology: {
      repositoryDegree: degrees([...repoDegree.values()]),
      nodeDegree: degrees([...nodeRepos.values()].map((r) => r.length)),
      connectedComponents: componentSizes.size,
      largestComponentVertices: Math.max(0, ...componentSizes.values()),
      isolatedMetadataOnly: metadataOnly,
      largestHubs: [...nodeRepos]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([nid, r]) => ({ subjectNid: nid, repositories: r.length })),
      journeys,
    },
  };
}

export function coverageReport(db: Db, config: Config, now = Date.now(), revision = 'unknown') {
  return db.transaction(() => {
    const ref = referenceTime(db, now);
    const cohort = sources(db);
    const configurationFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          mode: config.mode,
          preset: config.sourcePreset,
          sources: config.httpSources.map(
            ({ id, enabled, apiBaseUrl, expectedNid, metadataPriority }) => ({
              id,
              enabled,
              apiBaseUrl,
              expectedNid,
              metadataPriority,
            }),
          ),
          collection: config.collection,
          presentation: config.presentation,
        }),
      )
      .digest('hex');
    const windows = (['24h', '7d', 'all'] as const).map((window) => windowReport(db, window, ref));
    const collector = db.prepare('SELECT * FROM collector_status WHERE id=1').get() as
      | {
          started_at: number;
          heartbeat: number;
          stopped_at: number | null;
          candidate_deferrals: number;
        }
      | undefined;
    const sourceReports = cohort.map((source) => {
      const catalog = db
        .prepare('SELECT * FROM catalog_progress WHERE source_id=?')
        .get(source.id) as
        | {
            next_page: number;
            records: number;
            previous_records: number | null;
            completed_at: number | null;
            cycle_started_at: number;
            last_error: string | null;
          }
        | undefined;
      const pending = db
        .prepare(
          "SELECT COUNT(*) count,MIN(due_at) oldest,SUM(last_error='budget-deferred') deferred FROM metadata_jobs WHERE source_id=? AND status='pending'",
        )
        .get(source.id) as { count: number; oldest: number | null; deferred: number | null };
      const candidates = count(
        db,
        "SELECT COUNT(*) count FROM metadata_jobs WHERE source_id=? AND task='other-inventory'",
        source.id,
      );
      const refreshes = db
        .prepare(
          'SELECT scheduled_at,started_at,ended_at,outcome FROM inventory_refreshes WHERE source_id=? AND scheduled_at>=? AND scheduled_at<=?',
        )
        .all(source.id, ref - 86400000, ref) as {
        scheduled_at: number;
        started_at: number;
        ended_at: number | null;
        outcome: string | null;
      }[];
      const completed = refreshes.filter((r) => r.outcome === 'success');
      return {
        ...source,
        catalog: catalog
          ? {
              status: catalog.completed_at ? 'bounded-enumeration' : 'partial',
              nextPage: catalog.next_page,
              records: catalog.records,
              previousRecords: catalog.previous_records,
              recordCountDelta:
                catalog.previous_records === null
                  ? null
                  : catalog.records - catalog.previous_records,
              startedAt: new Date(catalog.cycle_started_at).toISOString(),
              completedAt: catalog.completed_at
                ? new Date(catalog.completed_at).toISOString()
                : null,
              error: catalog.last_error,
            }
          : { status: 'unknown' },
        referenceCompleteness: {
          catalog: null,
          inventory: null,
          metadata: null,
          reason: 'Independent reference enumeration not supplied',
        },
        backlog: {
          jobs: pending.count,
          budgetDeferred: pending.deferred ?? 0,
          oldestDueAt: pending.oldest === null ? null : new Date(pending.oldest).toISOString(),
          overdueMs: pending.oldest === null ? 0 : Math.max(0, ref - pending.oldest),
          candidateSubjects: candidates,
          minimumCandidateDrainHours: candidates / config.collection.otherInventoriesPerHour,
          maximumSubjectRequestsPerDay: 24 * config.collection.otherInventoriesPerHour,
        },
        freshness: {
          selfInventoryAttempts: refreshes.length,
          successfulAttempts: completed.length,
          failedAttempts: refreshes.filter((r) => r.outcome && r.outcome !== 'success').length,
          withinTwoIntervals: completed.filter(
            (r) =>
              r.ended_at !== null &&
              r.ended_at - r.scheduled_at <= 2 * config.collection.inventoryRefreshMs,
          ).length,
          reachableSupportedDenominator: null,
          reason:
            'Reachability-qualified schedule denominator requires completed experiment evaluation',
        },
      };
    });
    const current = windows[0]!;
    return {
      schemaVersion: 1,
      applicationRevision: revision,
      configurationFingerprint,
      preset: config.sourcePreset,
      dataMode: dataset(db).kind,
      evaluation: {
        from: new Date(ref - 86400000).toISOString(),
        to: new Date(ref).toISOString(),
        activeCollectionHours: null,
        wallElapsedSinceCollectorStartHours: collector
          ? (ref - collector.started_at) / 3600000
          : null,
      },
      queryDefinitions: {
        window:
          '24h/7d: present eligible source routes with last_positive_at in rolling window; all: retained positive evidence including missing routes',
        header: 'public repositories include metadata-only records',
        contribution:
          'unique relative to union of other source IDs; observer NIDs deduplicated separately',
        completeness:
          'unknown without independent bounded reference enumeration; never global-network percentage',
      },
      collector: {
        state: !collector
          ? 'never-started'
          : collector.stopped_at !== null
            ? 'stopped'
            : ref - collector.heartbeat > 3 * config.collection.schedulerTickMs
              ? 'stale'
              : 'running',
        heartbeat: collector ? new Date(collector.heartbeat).toISOString() : null,
        stoppedAt: collector?.stopped_at ? new Date(collector.stopped_at).toISOString() : null,
        candidateDeferrals: collector?.candidate_deferrals ?? 0,
      },
      sourceCohort: sourceReports,
      distinctSuccessfulObserverNids: new Set(
        cohort.filter((s) => s.observerNid && s.lastSuccess).map((s) => s.observerNid),
      ).size,
      windows,
      quarantine: {
        repositories: count(
          db,
          'SELECT COUNT(*) count FROM repositories WHERE rid NOT IN (SELECT rid FROM public_repositories)',
        ),
        privateMetadataRecords: count(
          db,
          "SELECT COUNT(*) count FROM repository_metadata WHERE visibility='private'",
        ),
      },
      candidates: {
        publicSubjects: count(
          db,
          "SELECT COUNT(DISTINCT c.nid) count FROM node_candidates c JOIN sources s ON s.id=c.evidence_source_id WHERE s.publication_policy!='quarantine'",
        ),
        records: count(db, 'SELECT COUNT(*) count FROM node_candidates'),
        cap: 10000,
      },
      gates: {
        repositories: {
          target: 1000,
          observed: current.hostingRepositories,
          met: current.hostingRepositories >= 1000,
        },
        subjectNodes: {
          target: 100,
          observed: current.subjectNodes,
          met: current.subjectNodes >= 100,
        },
        multiHostRepositories: {
          target: 100,
          observed: current.multiHostRepositories,
          met: current.multiHostRepositories >= 100,
        },
        usableNames: {
          targetPercent: 90,
          observedPercent: current.metadata.namePercent,
          met: (current.metadata.namePercent ?? 0) >= 90,
        },
        sustained24Hours: 'unverified',
        sourceRelativeCompleteness: 'unknown',
        operatorDiversity: 'consult reviewed registry',
        userAcceptance: 'not received',
      },
    };
  })();
}

export function renderCoverageMarkdown(report: ReturnType<typeof coverageReport>) {
  return `# ratlas public coverage\n\nRevision: ${report.applicationRevision}\n\nEvaluation: ${report.evaluation.from} to ${report.evaluation.to}; mode: ${report.dataMode}.\n\nCollector: ${report.collector.state}. Successful distinct observers: ${report.distinctSuccessfulObserverNids}.\n\n| Window | Header repositories | Hosting RIDs | Subjects | Pairs | Multi-host RIDs | Metadata-only | Name coverage |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${report.windows.map((w) => `| ${w.window} | ${w.header.repositories} | ${w.hostingRepositories} | ${w.subjectNodes} | ${w.hostingPairs} | ${w.multiHostRepositories} | ${w.metadataOnly} | ${w.metadata.namePercent?.toFixed(1) ?? 'unknown'}% |`).join('\n')}\n\n| Source | Observer | Catalog | Page progress | Reference completeness | Deferred jobs |\n| --- | --- | --- | --- | --- | --- |\n${report.sourceCohort.map((s) => `| ${s.id} | ${s.observerNid ?? 'unknown'} | ${s.catalog.status} | ${'nextPage' in s.catalog ? s.catalog.nextPage : 'unknown'} | unknown | ${s.backlog.budgetDeferred} |`).join('\n')}\n\nIndependent completeness denominators, reachability-qualified freshness and 24-hour active collection remain unverified unless separately evaluated. Counts describe observed public evidence, not verified uptime or global network coverage. Candidates create no hosting edges.\n`;
}
