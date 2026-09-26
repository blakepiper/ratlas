import { graphSchema, type z } from '@ratlas/core';

export type GraphData = z.infer<typeof graphSchema>;
export type GraphNode = GraphData['nodes'][number];
export type GraphEdge = GraphData['edges'][number];

export function fnv1a(value: string) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(value)) hash = Math.imul(hash ^ byte, 16777619);
  return hash >>> 0;
}

export function seededPosition(key: string) {
  let seed = fnv1a(key);
  const random = () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const angle = random() * Math.PI * 2;
  const radius = 0.25 + random() * 0.75;
  return { x: Math.cos(angle) * radius + 0.00001, y: Math.sin(angle) * radius + 0.00001 };
}

export function visibleGraph(
  data: Pick<GraphData, 'nodes' | 'edges'>,
  hideHubs: boolean,
  threshold: number,
) {
  const nodes = hideHubs
    ? data.nodes.filter((node) => node.kind !== 'node' || node.degree <= threshold)
    : data.nodes;
  const keys = new Set(nodes.map((node) => node.key));
  const edges = data.edges.filter((edge) => keys.has(edge.source) && keys.has(edge.target));
  return {
    nodes,
    edges,
    hiddenNodes: data.nodes.length - nodes.length,
    hiddenEdges: data.edges.length - edges.length,
  };
}
