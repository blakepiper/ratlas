import { graphSchema, graphLimitSchema, type GraphQuery, type Config } from '@ratlas/core';
import type { Db } from './connection.js';
import { filterSql, coverage, revision, iso } from './public.js';
import { referenceTime } from './queries.js';
export function fnv1a(input: string) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(input)) hash = Math.imul(hash ^ byte, 16777619);
  return hash >>> 0;
}
const binary = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function graphProjection(
  db: Db,
  query: GraphQuery,
  presentation: Config['presentation'],
  now = Date.now(),
) {
  const { sql, parameters } = filterSql(db, query, now);
  const repos = db
    .prepare(sql + ' SELECT rid,name FROM filtered_repos ORDER BY rid COLLATE BINARY')
    .all(parameters) as { rid: string; name: string | null }[];
  const routes = db
    .prepare(sql + ' SELECT * FROM filtered_routes ORDER BY rid COLLATE BINARY,nid COLLATE BINARY')
    .all(parameters) as { rid: string; nid: string; current: number }[];
  type Vertex = { key: string; id: string; kind: 'repo' | 'node'; label: string; degree: number };
  const vertices = new Map<string, Vertex>();
  for (const repo of repos)
    vertices.set('repo:' + repo.rid, {
      key: 'repo:' + repo.rid,
      id: repo.rid,
      kind: 'repo',
      label: '[repo] ' + (repo.name ?? repo.rid),
      degree: 0,
    });
  const edges = routes.map((route) => {
    const key = 'node:' + route.nid;
    if (!vertices.has(key))
      vertices.set(key, {
        key,
        id: route.nid,
        kind: 'node',
        label: '[node] ' + route.nid,
        degree: 0,
      });
    vertices.get(key)!.degree++;
    vertices.get('repo:' + route.rid)!.degree++;
    return {
      key: route.rid + ':' + route.nid,
      source: key,
      target: 'repo:' + route.rid,
      weight: 1 as const,
      historical: !route.current,
    };
  });
  const budget =
    presentation[
      query.mode === 'full' ? 'full' : query.mode === 'neighborhood' ? 'neighborhood' : 'overview'
    ];
  const limit = {
    vertices: Math.min(query.vertices, budget.vertices),
    edges: Math.min(query.edges, budget.edges),
  };
  let candidates = Array.from(vertices.values()),
    eligibleEdges = edges;
  const selected = query.selected ? vertices.get(query.selected) : undefined;
  if (query.mode === 'neighborhood') {
    if (!selected) return null;
    eligibleEdges = edges.filter((e) => e.source === selected.key || e.target === selected.key);
    const keys = new Set([selected.key, ...eligibleEdges.flatMap((e) => [e.source, e.target])]);
    candidates = candidates.filter((n) => keys.has(n.key));
  }
  if (
    query.mode === 'full' &&
    (candidates.length > limit.vertices || eligibleEdges.length > limit.edges)
  )
    return graphLimitSchema.parse({
      error: 'Full graph exceeds limits',
      eligibleNodeCount: candidates.length,
      eligibleEdgeCount: eligibleEdges.length,
      limits: limit,
      datasetRevision: revision(db),
    });
  const chosen = new Set<string>();
  const returned: typeof edges = [];
  if (query.mode === 'full') {
    for (const node of candidates) chosen.add(node.key);
    returned.push(...eligibleEdges);
  } else if (query.mode === 'neighborhood') {
    chosen.add(selected!.key);
    const byNeighbor = new Map<string, (typeof edges)[number]>();
    for (const edge of eligibleEdges)
      byNeighbor.set(edge.source === selected!.key ? edge.target : edge.source, edge);
    const neighbors = candidates
      .filter((n) => n.key !== selected!.key)
      .sort((a, b) => b.degree - a.degree || binary(a.id, b.id));
    for (const node of neighbors) {
      if (chosen.size >= limit.vertices || returned.length >= limit.edges) break;
      chosen.add(node.key);
      returned.push(byNeighbor.get(node.key)!);
    }
  } else {
    const byRepo = new Map<string, typeof edges>();
    for (const edge of edges) {
      const list = byRepo.get(edge.target) ?? [];
      list.push(edge);
      byRepo.set(edge.target, list);
    }
    const ordered = repos.sort((a, b) => fnv1a(a.rid) - fnv1a(b.rid) || binary(a.rid, b.rid));
    for (const repo of ordered) {
      const key = 'repo:' + repo.rid;
      if (chosen.size >= limit.vertices) break;
      chosen.add(key);
      for (const edge of byRepo.get(key) ?? []) {
        if (returned.length >= limit.edges) break;
        if (!chosen.has(edge.source) && chosen.size >= limit.vertices) continue;
        chosen.add(edge.source);
        returned.push(edge);
      }
    }
  }
  const vertexTruncated = chosen.size < candidates.length,
    edgeTruncated = returned.length < eligibleEdges.length;
  return graphSchema.parse({
    nodes: Array.from(chosen).map((key) => vertices.get(key)!),
    edges: returned,
    scope: query.mode,
    filters: {
      q: query.q,
      metadata: query.metadata,
      source: query.source,
      minSeeders: query.minSeeders,
      maxSeeders: query.maxSeeders,
    },
    observationWindow: query.window,
    eligibleNodeCount: candidates.length,
    eligibleEdgeCount: eligibleEdges.length,
    returnedNodeCount: chosen.size,
    returnedEdgeCount: returned.length,
    truncated: vertexTruncated || edgeTruncated,
    vertexTruncated,
    edgeTruncated,
    truncationReason:
      vertexTruncated || edgeTruncated
        ? [
            vertexTruncated ? 'vertex limit' : null,
            edgeTruncated ? 'edge selection limited by vertex/edge budgets' : null,
          ]
            .filter(Boolean)
            .join('; ')
        : null,
    selectionMethod:
      query.mode === 'overview'
        ? 'RID UTF-8 FNV-1a 32-bit ascending; binary RID tie-break; binary NID neighbors'
        : query.mode === 'neighborhood'
          ? 'selected entity first; filtered neighbor degree descending, canonical ID ascending'
          : 'all eligible entities within configured hard limits',
    datasetRevision: revision(db),
    generatedAt: iso(referenceTime(db, now)),
    coverage: coverage(db),
  });
}
