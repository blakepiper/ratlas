import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Graph from 'graphology';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import Sigma from 'sigma';
import { graphLimitSchema, graphSchema, type z } from '@ratlas/core';
import { conciseId, type Selection } from './explore.js';
import {
  seededPosition,
  visibleGraph,
  type GraphData,
  type GraphEdge,
  type GraphNode,
} from './graphModel.js';
import styles from './GraphMap.module.css';

type GraphMode = 'overview' | 'neighborhood' | 'full';
type GraphLimit = z.infer<typeof graphLimitSchema>;
type GraphResult = GraphData | GraphLimit;
type Position = { x: number; y: number };

class GraphRequestError extends Error {
  constructor(readonly status: number) {
    super('The graph request could not be completed.');
  }
}

async function loadGraph(path: string, signal: AbortSignal): Promise<GraphResult> {
  const response = await fetch(path, { signal });
  if (response.status === 422) {
    const body = (await response.json()) as Record<string, unknown>;
    delete body.requestId;
    return graphLimitSchema.parse(body);
  }
  if (!response.ok) throw new GraphRequestError(response.status);
  return graphSchema.parse(await response.json());
}

function GraphCanvas({
  nodes,
  edges,
  selectedKey,
  mode,
  onSelect,
  onRendererUnavailable,
  positions,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey: string | null;
  mode: GraphMode;
  onSelect: (key: string) => void;
  onRendererUnavailable: () => void;
  positions: Map<string, Position>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const renderer = useRef<Sigma | null>(null);
  const layout = useRef<FA2Layout | null>(null);
  const graph = useRef<Graph | null>(null);
  const timer = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUnavailableRef = useRef(onRendererUnavailable);
  onUnavailableRef.current = onRendererUnavailable;
  const selectedRef = useRef(selectedKey);
  selectedRef.current = selectedKey;
  const hoveredRef = useRef<string | null>(null);
  const labelsRef = useRef(false);
  const allEdgesRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const focusedLabels = mode === 'neighborhood' && nodes.length <= 200;
  const limitedEdges = edges.length > 10_000;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setReady(element.clientWidth > 0 && element.clientHeight > 0);
      renderer.current?.resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || renderError || !container.current || !nodes.length) return;
    setRendered(false);
    const instance = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
    for (const node of nodes) {
      const point = positions.get(node.key) ?? seededPosition(node.key);
      instance.addNode(node.key, {
        ...point,
        label: node.label,
        color: node.kind === 'repo' ? '#d5a562' : '#67a8c8',
        size: node.kind === 'repo' ? 3 : 6,
        kind: node.kind,
        id: node.id,
      });
    }
    for (const edge of edges)
      instance.addEdgeWithKey(edge.key, edge.source, edge.target, {
        weight: 1,
        size: 0.7,
        color: edge.historical ? '#566272' : '#526477',
      });
    graph.current = instance;
    let sigma: Sigma | null = null;
    let worker: FA2Layout | null = null;
    let lost = false;
    const updateRing = () => {
      const marker = ring.current;
      const key = selectedRef.current;
      if (!marker || !sigma || !key || !instance.hasNode(key)) {
        if (marker) marker.hidden = true;
        return;
      }
      const point = sigma.graphToViewport(instance.getNodeAttributes(key) as Position);
      const display = sigma.getNodeDisplayData(key);
      const radius = (display?.size ?? 6) + 5;
      marker.hidden = false;
      marker.style.left = `${point.x - radius}px`;
      marker.style.top = `${point.y - radius}px`;
      marker.style.width = `${radius * 2}px`;
      marker.style.height = `${radius * 2}px`;
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (lost) return;
      lost = true;
      onUnavailableRef.current();
      setRenderError('WebGL context lost. The repository list and details remain available.');
    };
    try {
      sigma = new Sigma(instance, container.current, {
        renderLabels: true,
        labelFont: 'system-ui, sans-serif',
        labelColor: { color: '#e8edf2' },
        defaultEdgeColor: '#526477',
        zIndex: true,
        nodeReducer: (key, attributes) => {
          const focused = key === selectedRef.current || key === hoveredRef.current;
          return {
            ...attributes,
            label: focusedLabels || labelsRef.current || focused ? attributes.label : null,
            forceLabel: focused,
            highlighted: focused,
            zIndex: focused ? 1 : 0,
          };
        },
        edgeReducer: (key, attributes) => {
          if (!limitedEdges || allEdgesRef.current) return attributes;
          const [source, target] = instance.extremities(key);
          const selected = selectedRef.current;
          const hovered = hoveredRef.current;
          return {
            ...attributes,
            hidden:
              source !== selected &&
              target !== selected &&
              source !== hovered &&
              target !== hovered,
          };
        },
      });
      renderer.current = sigma;
      sigma.on('clickNode', ({ node }) => onSelectRef.current(node));
      sigma.on('enterNode', ({ node }) => {
        hoveredRef.current = node;
        setHoveredKey(node);
        sigma?.refresh();
      });
      sigma.on('leaveNode', () => {
        hoveredRef.current = null;
        setHoveredKey(null);
        sigma?.refresh();
      });
      sigma.on('afterRender', updateRing);
      for (const canvas of Object.values(sigma.getCanvases()))
        canvas.addEventListener('webglcontextlost', onContextLost);
      sigma.refresh();
      setRendered(true);
      if (instance.order > 1 && instance.size > 0) {
        try {
          worker = new FA2Layout(instance, {
            settings: {
              barnesHutOptimize: true,
              barnesHutTheta: 0.5,
              linLogMode: true,
              scalingRatio: 10,
              gravity: 1,
              slowDown: 5,
              edgeWeightInfluence: 0,
            },
          });
          layout.current = worker;
          setLayoutReady(true);
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            worker.start();
            setRunning(true);
            timer.current = window.setTimeout(
              () => {
                worker?.stop();
                setRunning(false);
                timer.current = null;
              },
              mode === 'full' ? 10_000 : 5_000,
            );
          }
        } catch {
          setLayoutError(true);
        }
      }
    } catch {
      lost = true;
      for (const canvas of Object.values(sigma?.getCanvases() ?? {}))
        canvas.removeEventListener('webglcontextlost', onContextLost);
      sigma?.kill();
      container.current?.replaceChildren();
      renderer.current = null;
      layout.current = null;
      setLayoutReady(false);
      setRendered(false);
      onUnavailableRef.current();
      setRenderError('WebGL is unavailable. Use the repository list and details to browse.');
    }
    return () => {
      lost = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      worker?.stop();
      worker?.kill();
      layout.current = null;
      for (const key of instance.nodes()) {
        const attributes = instance.getNodeAttributes(key);
        positions.set(key, { x: attributes.x as number, y: attributes.y as number });
      }
      for (const canvas of Object.values(sigma?.getCanvases() ?? {}))
        canvas.removeEventListener('webglcontextlost', onContextLost);
      sigma?.kill();
      renderer.current = null;
      graph.current = null;
      setRunning(false);
    };
  }, [ready, renderError, nodes, edges, mode, positions, focusedLabels, limitedEdges]);

  useEffect(() => {
    selectedRef.current = selectedKey;
    renderer.current?.refresh();
  }, [selectedKey]);

  function toggleLayout() {
    const worker = layout.current;
    if (!worker) return;
    if (worker.isRunning()) {
      worker.stop();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setRunning(false);
      return;
    }
    worker.start();
    setRunning(true);
    timer.current = window.setTimeout(
      () => {
        worker.stop();
        timer.current = null;
        setRunning(false);
      },
      mode === 'full' ? 10_000 : 5_000,
    );
  }

  function move(dx: number, dy: number) {
    const camera = renderer.current?.getCamera();
    if (!camera) return;
    const distance = 0.12 * camera.getState().ratio;
    camera.updateState(({ x, y }) => ({ x: x + dx * distance, y: y + dy * distance }));
  }

  function zoom(factor: number) {
    renderer.current?.getCamera().updateState(({ ratio }) => ({ ratio: ratio * factor }));
  }

  function fit() {
    renderer.current?.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
  }

  function reset() {
    layout.current?.stop();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setRunning(false);
    const instance = graph.current;
    if (instance) {
      for (const key of instance.nodes()) {
        const point = seededPosition(key);
        instance.setNodeAttribute(key, 'x', point.x);
        instance.setNodeAttribute(key, 'y', point.y);
        positions.set(key, point);
      }
    }
    fit();
  }

  const hoveredNode = nodes.find((node) => node.key === hoveredKey);
  const selectedNode = nodes.find((node) => node.key === selectedKey);
  return (
    <>
      {rendered && (
        <div className={styles.canvasToolbar} aria-label="Map navigation controls">
          <button type="button" onClick={() => move(-1, 0)} aria-label="Pan left">
            ←
          </button>
          <button type="button" onClick={() => move(0, -1)} aria-label="Pan up">
            ↑
          </button>
          <button type="button" onClick={() => move(0, 1)} aria-label="Pan down">
            ↓
          </button>
          <button type="button" onClick={() => move(1, 0)} aria-label="Pan right">
            →
          </button>
          <button type="button" onClick={() => zoom(0.75)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={fit}>
            Fit
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
          <button type="button" onClick={toggleLayout} disabled={!layoutReady}>
            {running ? 'Pause layout' : 'Resume layout'}
          </button>
          <label>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => {
                labelsRef.current = event.target.checked;
                setShowLabels(event.target.checked);
                renderer.current?.refresh();
              }}
            />
            Show labels
          </label>
          {limitedEdges && (
            <label>
              <input
                type="checkbox"
                checked={showAllEdges}
                onChange={(event) => {
                  allEdgesRef.current = event.target.checked;
                  setShowAllEdges(event.target.checked);
                  renderer.current?.refresh();
                }}
              />
              All returned edges
            </label>
          )}
        </div>
      )}
      {rendered && limitedEdges && !showAllEdges && (
        <p className={styles.displayNote}>
          Showing only edges beside the selected or hovered entity; API results are unchanged.
        </p>
      )}
      {rendered && layoutError && (
        <p role="status" className={styles.displayNote}>
          The layout worker is unavailable; the map remains navigable.
        </p>
      )}
      <div className={`${styles.stage} ${renderError ? styles.stageFallback : ''}`}>
        <div
          ref={container}
          className={styles.canvas}
          aria-label="Interactive relationship map"
          data-graph-renderer={renderError ? 'fallback' : rendered ? 'webgl' : 'pending'}
        />
        <div ref={ring} className={styles.selectionRing} hidden aria-hidden="true" />
        {renderError && (
          <div className={styles.fallback} role="status">
            <p>{renderError}</p>
            <button type="button" onClick={() => setRenderError(null)}>
              Retry map renderer
            </button>
          </div>
        )}
      </div>
      {(hoveredNode ?? selectedNode) && (
        <div className={styles.entityInfo}>
          <strong>
            {hoveredNode ? 'Hovered' : 'Selected'}{' '}
            {(hoveredNode ?? selectedNode)?.kind === 'repo' ? 'repository' : 'node identity'}
          </strong>
          <span>{(hoveredNode ?? selectedNode)!.label}</span>
          <code>{(hoveredNode ?? selectedNode)!.id}</code>
        </div>
      )}
    </>
  );
}

export function GraphMap({
  filterQuery,
  selected,
  datasetRevision,
  windowBucket,
  active,
  onSelect,
  onClearSelection,
}: {
  filterQuery: string;
  selected: Selection | null;
  datasetRevision: number | undefined;
  windowBucket: number | undefined;
  active: boolean;
  onSelect: (selection: Selection) => void;
  onClearSelection: () => void;
}) {
  const [mode, setMode] = useState<GraphMode>('overview');
  const [hideHubs, setHideHubs] = useState(false);
  const [threshold, setThreshold] = useState(1000);
  const [notice, setNotice] = useState<string | null>(null);
  const [entityListOpen, setEntityListOpen] = useState(false);
  const positions = useRef(new Map<string, Position>());
  const selectedKey = selected ? `${selected.kind}:${selected.id}` : null;

  useEffect(() => {
    if (selectedKey) setMode('neighborhood');
    else setMode((current) => (current === 'neighborhood' ? 'overview' : current));
  }, [selectedKey]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(filterQuery);
    params.set('mode', mode);
    if (mode === 'neighborhood' && selectedKey) params.set('selected', selectedKey);
    params.set('vertices', mode === 'full' ? '25000' : '2000');
    params.set('edges', mode === 'full' ? '150000' : '10000');
    return params.toString();
  }, [filterQuery, mode, selectedKey]);
  const request = useQuery({
    queryKey: ['graph', queryString, datasetRevision, windowBucket],
    enabled: mode !== 'neighborhood' || !!selectedKey,
    queryFn: ({ signal }) => loadGraph(`/api/v1/graph?${queryString}`, signal),
  });
  useEffect(() => {
    if (request.error instanceof GraphRequestError && request.error.status === 404 && selectedKey) {
      setNotice('The selected entity is outside the active graph filters. Selection was cleared.');
      onClearSelection();
    }
  }, [request.error, selectedKey, onClearSelection]);

  const result = request.data;
  const data = result && !('error' in result) ? result : null;
  const limit = result && 'error' in result ? result : null;
  const displayed = useMemo(
    () => (data ? visibleGraph(data, hideHubs, threshold) : null),
    [data, hideHubs, threshold],
  );
  function selectKey(key: string) {
    const node = data?.nodes.find((entry) => entry.key === key);
    if (node) onSelect({ kind: node.kind, id: node.id });
  }

  return (
    <section className={styles.map} aria-labelledby="map-heading" data-active={active}>
      <div className={styles.heading}>
        <h2 id="map-heading">Relationship map</h2>
        <span>Observed hosting · [repo] ↔ [node]</span>
      </div>
      <div className={styles.controls}>
        <label>
          View
          <select
            aria-label="Graph view"
            value={mode}
            onChange={(event) => setMode(event.target.value as GraphMode)}
          >
            <option value="overview">Bounded overview</option>
            <option value="neighborhood" disabled={!selectedKey}>
              Selected neighborhood
            </option>
            <option value="full">Full eligible dataset</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={hideHubs}
            onChange={(event) => setHideHubs(event.target.checked)}
          />
          Hide large hosting nodes
        </label>
        <label>
          Degree above
          <input
            type="number"
            min="1"
            max="2000000"
            value={threshold}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= 2_000_000) setThreshold(value);
            }}
          />
        </label>
      </div>
      {notice && (
        <p role="status" className={styles.message}>
          {notice}
        </p>
      )}
      {request.isPending && (
        <p role="status" className={styles.message}>
          Loading graph observations…
        </p>
      )}
      {request.isError &&
        !(request.error instanceof GraphRequestError && request.error.status === 404) && (
          <p role="alert" className={styles.message}>
            The graph is unavailable. The repository list and details remain usable.
          </p>
        )}
      {limit && (
        <div role="alert" className={styles.message}>
          Full graph needs {limit.eligibleNodeCount.toLocaleString()} vertices and{' '}
          {limit.eligibleEdgeCount.toLocaleString()} edges; this installation allows{' '}
          {limit.limits.vertices.toLocaleString()} vertices and{' '}
          {limit.limits.edges.toLocaleString()} edges for this request. This is not a full view.
          <button type="button" onClick={() => setMode('overview')}>
            Use bounded overview
          </button>
        </div>
      )}
      {data && displayed && (
        <>
          <div className={styles.counts} role="status">
            <strong>
              Displaying {displayed.nodes.length.toLocaleString()} of{' '}
              {data.eligibleNodeCount.toLocaleString()} eligible entities
            </strong>
            <span>
              {displayed.edges.length.toLocaleString()} of {data.eligibleEdgeCount.toLocaleString()}{' '}
              eligible relationships
            </span>
          </div>
          {(data.vertexTruncated || data.edgeTruncated) && (
            <p className={styles.displayNote}>
              API selection is bounded:{' '}
              {data.vertexTruncated ? 'vertex limit reached' : 'vertices complete'};{' '}
              {data.edgeTruncated ? 'edge limit reached' : 'edges complete'}. The searchable catalog
              is unaffected.
            </p>
          )}
          {displayed.hiddenNodes > 0 && (
            <p className={styles.displayNote}>
              {displayed.hiddenNodes.toLocaleString()} large hosting nodes and{' '}
              {displayed.hiddenEdges.toLocaleString()} incident edges hidden on this map only.
              Counts and filters are unchanged.
            </p>
          )}
          {selectedKey &&
            data.nodes.some((node) => node.key === selectedKey) &&
            !displayed.nodes.some((node) => node.key === selectedKey) && (
              <p className={styles.displayNote}>
                The selected node is hidden by the display threshold.{' '}
                <button type="button" onClick={() => setHideHubs(false)}>
                  Show selected node
                </button>
              </p>
            )}
          <p className={styles.selectionMethod}>
            Selection: {data.selectionMethod}. Coverage is limited to configured observers; this is
            not the whole Radicle network.
          </p>
          {displayed.nodes.length ? (
            <>
              <GraphCanvas
                nodes={displayed.nodes}
                edges={displayed.edges}
                selectedKey={selectedKey}
                mode={mode}
                onSelect={selectKey}
                onRendererUnavailable={() => setEntityListOpen(true)}
                positions={positions.current}
              />
              <details
                className={styles.entityList}
                open={entityListOpen}
                onToggle={(event) => setEntityListOpen(event.currentTarget.open)}
              >
                <summary>Map entities ({displayed.nodes.length.toLocaleString()})</summary>
                <ul>
                  {displayed.nodes.slice(0, 50).map((node) => (
                    <li key={node.key}>
                      <button type="button" onClick={() => selectKey(node.key)}>
                        {node.label} · {conciseId(node.id)}
                      </button>
                    </li>
                  ))}
                </ul>
                {displayed.nodes.length > 50 && (
                  <p>First 50 returned entities shown here. Search the catalog for others.</p>
                )}
              </details>
            </>
          ) : (
            <p className={styles.message}>
              No eligible graph entities in this view. Adjust the data filters or hub display
              threshold.
            </p>
          )}
        </>
      )}
    </section>
  );
}
