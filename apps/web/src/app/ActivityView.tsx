import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activitySchema, fullSummarySchema, historySchema, type z } from '@ratlas/core';
import { conciseId, dateLabel, type Selection } from './explore.js';
import styles from './ActivityView.module.css';

type Summary = z.infer<typeof fullSummarySchema>;
type HistoryItem = z.infer<typeof historySchema>['items'][number];
type Series = {
  key: 'repositories' | 'nodeIdentities' | 'hostingRelationships';
  label: string;
  color: string;
};

const series: Series[] = [
  { key: 'repositories', label: 'Repositories', color: '#d5a562' },
  { key: 'nodeIdentities', label: 'Node identities', color: '#67a8c8' },
  { key: 'hostingRelationships', label: 'Hosting relationships', color: '#e8edf2' },
];

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error('The local data service could not complete this request.');
  return response.json();
}

function SummaryChart({ items, window }: { items: HistoryItem[]; window: string }) {
  const max = Math.max(1, ...items.flatMap((item) => series.map(({ key }) => item[key])));
  const x = (index: number) => 42 + (items.length === 1 ? 258 : (index / (items.length - 1)) * 516);
  const y = (value: number) => 178 - (value / max) * 146;
  const latest = items.at(-1);
  return (
    <section className={styles.panel} aria-label="Summary history">
      <div className={styles.panelHeading}>
        <h2>Observed counts over time</h2>
        <span>{window} observation window · last 7 days of stored UTC-hour samples</span>
      </div>
      {items.length ? (
        <>
          <svg
            className={styles.chart}
            viewBox="0 0 600 220"
            role="img"
            aria-label={`Three count series from ${dateLabel(items[0]?.at)} to ${dateLabel(latest?.at)}; maximum ${max}`}
          >
            <line x1="42" y1="178" x2="558" y2="178" stroke="#526477" />
            <line x1="42" y1="32" x2="42" y2="178" stroke="#526477" />
            <text x="38" y="28" textAnchor="end" fill="#a7b4c2" fontSize="11">
              {max}
            </text>
            <text x="38" y="183" textAnchor="end" fill="#a7b4c2" fontSize="11">
              0
            </text>
            {series.map(({ key, label, color }) => (
              <g key={key} aria-label={label}>
                {items.length > 1 && (
                  <polyline
                    points={items.map((item, index) => `${x(index)},${y(item[key])}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {items.map((item, index) => (
                  <circle key={item.at} cx={x(index)} cy={y(item[key])} r="3" fill={color}>
                    <title>{`${label}: ${item[key]} at ${dateLabel(item.at)}`}</title>
                  </circle>
                ))}
              </g>
            ))}
            <text x="42" y="206" fill="#a7b4c2" fontSize="11">
              {items[0]?.at.slice(0, 10)}
            </text>
            <text x="558" y="206" textAnchor="end" fill="#a7b4c2" fontSize="11">
              {latest?.at.slice(0, 10)}
            </text>
          </svg>
          <div className={styles.legend} aria-label="Latest stored counts">
            {series.map(({ key, label, color }) => (
              <span key={key}>
                <i style={{ background: color }} aria-hidden="true" />
                {label}: <strong>{latest?.[key]}</strong>
              </span>
            ))}
          </div>
          <p className={styles.note}>Latest stored sample: {dateLabel(latest?.at)}.</p>
        </>
      ) : (
        <p className={styles.note}>No hourly samples are retained for this range yet.</p>
      )}
    </section>
  );
}

export function ActivityView({
  summary,
  window,
  onWindowChange,
  onSelect,
}: {
  summary: Summary | undefined;
  window: '24h' | '7d' | 'all';
  onWindowChange: (value: '24h' | '7d' | 'all') => void;
  onSelect: (selection: Selection) => void;
}) {
  const [source, setSource] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [source, window]);
  const activityParams = new URLSearchParams({ page: String(page), limit: '25', window });
  if (source) activityParams.set('source', source);
  const activityQuery = activityParams.toString();
  const reference = summary?.referenceTime;
  const chartParams = new URLSearchParams({ window, page: '0', limit: '200' });
  if (reference) {
    chartParams.set('to', reference);
    chartParams.set('from', new Date(Date.parse(reference) - 7 * 86400000).toISOString());
  }
  const historyQuery = chartParams.toString();
  const activity = useQuery({
    queryKey: ['activity', activityQuery, summary?.datasetRevision, summary?.windowBucket],
    queryFn: async ({ signal }) =>
      activitySchema.parse(await getJson(`/api/v1/activity?${activityQuery}`, signal)),
    refetchInterval: 15_000,
  });
  const history = useQuery({
    queryKey: ['history', historyQuery, summary?.datasetRevision],
    enabled: !!reference,
    queryFn: async ({ signal }) =>
      historySchema.parse(await getJson(`/api/v1/history/summary?${historyQuery}`, signal)),
    refetchInterval: 15_000,
  });
  const coverage = summary?.coverage;
  return (
    <div id="activity-view" className={styles.view}>
      <div className={styles.heading}>
        <div>
          <h2>Activity and coverage</h2>
          <p>
            Source observations from this installation. Changes do not prove global availability.
          </p>
        </div>
        <label>
          Observation window
          <select
            value={window}
            onChange={(event) => onWindowChange(event.target.value as typeof window)}
          >
            <option value="24h">Observed within 24 hours</option>
            <option value="7d">Observed within 7 days</option>
            <option value="all">All retained</option>
          </select>
        </label>
      </div>
      <p className={styles.boundary}>
        Retained history begins {dateLabel(coverage?.retainedHistoryFrom)}. Activity before that
        point is not shown; collection gaps may interrupt the feed.
      </p>
      <div className={styles.grid}>
        <div className={styles.left}>
          {history.isPending && <p role="status">Loading summary history…</p>}
          {history.isError && !history.data && <p role="alert">Summary history is unavailable.</p>}
          {history.data && <SummaryChart items={history.data.items} window={window} />}
          <section className={styles.panel} aria-label="Observation activity">
            <div className={styles.panelHeading}>
              <h2>Observation feed</h2>
              <label>
                Source
                <select value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="">All public sources</option>
                  {coverage?.sources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {activity.isPending && <p role="status">Loading observations…</p>}
            {activity.isError && (
              <p role="alert">
                {activity.data
                  ? 'The data service is unavailable; last loaded observations remain visible.'
                  : 'Observation feed is unavailable.'}
              </p>
            )}
            {activity.data?.items.length === 0 && (
              <p className={styles.note}>
                No observation changes or collection gaps in this range.
              </p>
            )}
            <ol className={styles.feed}>
              {activity.data?.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {dateLabel(item.observedAt)} · {item.sourceId}
                  </span>
                  <strong>{item.message}</strong>
                  {item.kind === 'gap' ? (
                    <small>
                      {item.endedAt ? `Gap closed ${dateLabel(item.endedAt)}` : 'Gap still open'}.
                      Cached observations are retained.
                    </small>
                  ) : (
                    <div className={styles.entities}>
                      {item.rid && (
                        <button
                          type="button"
                          onClick={() => onSelect({ kind: 'repo', id: item.rid! })}
                        >
                          [repo] {conciseId(item.rid)}
                        </button>
                      )}
                      {item.nid && (
                        <button
                          type="button"
                          onClick={() => onSelect({ kind: 'node', id: item.nid! })}
                        >
                          [node] {conciseId(item.nid)}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {(activity.data?.total ?? 0) > 25 && (
              <nav className={styles.pages} aria-label="Activity pages">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(activity.data!.total / 25)}
                </span>
                <button
                  type="button"
                  disabled={(page + 1) * 25 >= activity.data!.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        </div>
        <aside className={styles.panel} aria-label="Source coverage">
          <h2>Source coverage</h2>
          <p>{coverage?.limitations ?? 'Loading source coverage…'}</p>
          <p>Collection status: {coverage?.collectionStatus ?? 'Loading'}</p>
          <p>{summary?.unresolvedMetadata ?? '—'} repository names unresolved.</p>
          {coverage && (
            <dl className={styles.metrics}>
              <div>
                <dt>Retained data / WAL</dt>
                <dd>
                  {coverage.maintenance.lastMeasuredAt
                    ? `${(coverage.maintenance.databaseBytes / 1048576).toFixed(1)} / ${(coverage.maintenance.walBytes / 1048576).toFixed(1)} MiB`
                    : 'Not measured yet'}
                </dd>
              </div>
              <div>
                <dt>Last retention pass</dt>
                <dd>{dateLabel(coverage.maintenance.lastPrunedAt)}</dd>
              </div>
              <div>
                <dt>Queued jobs / peak</dt>
                <dd>
                  {coverage.maintenance.queueDepth} / {coverage.maintenance.queueHighWater}
                </dd>
              </div>
              <div>
                <dt>Event backlog / peak</dt>
                <dd>
                  {coverage.maintenance.eventBacklog} / {coverage.maintenance.eventBacklogHighWater}
                </dd>
              </div>
            </dl>
          )}
          {coverage?.sources.map((item) => (
            <section key={item.id} className={styles.source} aria-label={item.label}>
              <h3>{item.label}</h3>
              <p>
                {item.adapter === 'synthetic'
                  ? 'Synthetic source'
                  : item.adapter === 'cli'
                    ? 'Configured observer'
                    : 'Public HTTP source'}
                {' · '}
                {item.enabled ? 'Enabled' : 'Disabled'}
              </p>
              <dl>
                <div>
                  <dt>Last successful snapshot</dt>
                  <dd>{dateLabel(item.lastCompleteSnapshot)}</dd>
                </div>
                <div>
                  <dt>Last successful collection</dt>
                  <dd>{dateLabel(item.lastSuccess)}</dd>
                </div>
                <div>
                  <dt>Current status</dt>
                  <dd>{item.error ?? 'No reported error'}</dd>
                </div>
                <div>
                  <dt>Interface</dt>
                  <dd>{item.capabilities.schema ?? item.adapter}</dd>
                </div>
                <div>
                  <dt>Partial runs</dt>
                  <dd>{item.partialRuns}</dd>
                </div>
                <div>
                  <dt>Last reconciliation</dt>
                  <dd>{dateLabel(item.lastReconciliation)}</dd>
                </div>
                <div>
                  <dt>Consecutive failures</dt>
                  <dd>{item.consecutiveFailures}</dd>
                </div>
                <div>
                  <dt>Circuit breaker</dt>
                  <dd>
                    {item.breaker}
                    {item.paused ? ' · paused' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Retry scheduled</dt>
                  <dd>{dateLabel(item.retryAt)}</dd>
                </div>
                <div>
                  <dt>Requests / queued jobs</dt>
                  <dd>
                    {item.requestCount} / {item.queueDepth}
                  </dd>
                </div>
              </dl>
              <details className={styles.diagnostics}>
                <summary>Collection diagnostics</summary>
                <dl>
                  <div>
                    <dt>Collector heartbeat</dt>
                    <dd>{dateLabel(item.heartbeat)}</dd>
                  </div>
                  <div>
                    <dt>Last event</dt>
                    <dd>{dateLabel(item.lastEvent)}</dd>
                  </div>
                  <div>
                    <dt>Event stream</dt>
                    <dd>{item.eventStreamStatus}</dd>
                  </div>
                  <div>
                    <dt>Observer identity</dt>
                    <dd>{item.observerNid ?? 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Parse / unknown events</dt>
                    <dd>
                      {item.parseErrors} / {item.unknownEvents}
                    </dd>
                  </div>
                  <div>
                    <dt>Decoded body bytes</dt>
                    <dd>{item.decodedBodyBytes}</dd>
                  </div>
                  <div>
                    <dt>Budget-deferred jobs</dt>
                    <dd>{item.deferredJobs}</dd>
                  </div>
                </dl>
              </details>
            </section>
          ))}
          {coverage?.sources.length === 0 && <p>No publishable sources are configured.</p>}
        </aside>
      </div>
    </div>
  );
}
