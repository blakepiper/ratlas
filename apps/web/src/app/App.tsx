import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  catalogSchema,
  fullSummarySchema,
  nodeDetailSchema,
  nodeReposSchema,
  randomRepoSchema,
  repoDetailSchema,
  seedersSchema,
  type z,
} from '@ratlas/core';
import {
  catalogParams,
  conciseId,
  dateLabel,
  filterParams,
  readExploreState,
  safeBrowseUrl,
  type Selection,
} from './explore.js';
import { GraphMap } from './GraphMap.js';
import { ActivityView } from './ActivityView.js';
import styles from './App.module.css';

type Repo = z.infer<typeof repoDetailSchema>;
type Node = z.infer<typeof nodeDetailSchema>;
type Summary = z.infer<typeof fullSummarySchema>;

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal: signal ?? null });
  if (!response.ok) throw new Error('The local data service could not complete this request.');
  return response.json();
}

function sourceState(info: Summary | undefined) {
  if (!info) return 'Checking sources…';
  if (info.coverage.collectionStatus === 'unconfigured') return 'No source configured';
  if (info.coverage.sources.some((item) => /unsupported|schema|version/iu.test(item.error ?? '')))
    return 'Source interface unsupported';
  if (info.coverage.collectionStatus === 'degraded') return 'Collection gap · cached observations';
  if (info.coverage.collectionStatus === 'idle') return 'Collection idle · cached observations';
  return 'Source observations cached';
}

function EmptyDetail({ info }: { info: Summary | undefined }) {
  return (
    <div className={styles.detailBody}>
      <p className={styles.eyebrow}>Observation coverage</p>
      <h3>Select a repository or node</h3>
      <p>Open a result to see metadata, source evidence, and observed relationships.</p>
      <dl>
        <div>
          <dt>Observation window</dt>
          <dd>{info?.observationWindow ?? '24h'}</dd>
        </div>
        <div>
          <dt>Metadata</dt>
          <dd>{info?.unresolvedMetadata ?? '—'} unresolved names</dd>
        </div>
        <div>
          <dt>Reference time</dt>
          <dd>{dateLabel(info?.referenceTime)}</dd>
        </div>
      </dl>
      <section aria-label="Source coverage" className={styles.coverage}>
        <h3>Evidence sources</h3>
        {info?.coverage.sources.map((source) => (
          <div key={source.id}>
            <strong>{source.label}</strong>
            <p>
              {source.adapter === 'synthetic'
                ? 'Synthetic source'
                : source.adapter === 'cli'
                  ? 'Configured observer'
                  : 'Public HTTP source'}{' '}
              ·{' '}
              {source.error
                ? 'Collection gap; cached data retained'
                : source.lastSuccess
                  ? 'Cached observations available'
                  : 'No successful collection yet'}
            </p>
            <p>Last successful snapshot: {dateLabel(source.lastCompleteSnapshot)}</p>
            {source.error && <p role="status">Source status: {sourceState(info)}</p>}
          </div>
        ))}
        {info?.coverage.sources.length === 0 && <p>No publishable sources are configured.</p>}
        <p>
          Counts describe this installation’s observations, not the whole network or current
          availability.
        </p>
      </section>
    </div>
  );
}

function Evidence({
  evidence,
}: {
  evidence: z.infer<typeof seedersSchema>['items'][number]['evidence'];
}) {
  return (
    <ul className={styles.evidence}>
      {evidence.map((item) => (
        <li key={`${item.sourceId}:${item.evidenceKind}`}>
          <strong>{item.sourceId}</strong> ·{' '}
          {item.state === 'present'
            ? 'Source reported a hosting relationship'
            : 'Relationship no longer in source snapshots'}
          <span>Source read: {dateLabel(item.lastObservedAt)}</span>
          <span>Announcement: {dateLabel(item.announcedAt)}</span>
          {item.observerNid && (
            <span>
              Observer: <code>{item.observerNid}</code>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RepoDetail({
  repo,
  seeders,
  seedersPending,
  seedersError,
  page,
  onPage,
  onSelect,
}: {
  repo: Repo;
  seeders: z.infer<typeof seedersSchema> | undefined;
  seedersPending: boolean;
  seedersError: boolean;
  page: number;
  onPage: (page: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const command = `rad clone ${repo.rid}`;
  const metadataDisagree =
    new Set(
      repo.metadataVariants.map((variant) =>
        JSON.stringify([variant.name, variant.description, variant.branch, variant.delegates]),
      ),
    ).size > 1;
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  }
  return (
    <div className={styles.detailBody}>
      <span className={styles.eyebrow}>[repo] Repository</span>
      <h3>{repo.name ?? 'Name unresolved'}</h3>
      <code className={styles.fullId}>{repo.rid}</code>
      {repo.metadataStatus === 'unresolved' && (
        <p className={styles.notice}>
          Metadata unresolved. The RID and observed hosting evidence remain available.
        </p>
      )}
      <p>{repo.description ?? 'No public description was returned by the configured sources.'}</p>
      {(repo.sourcesDisagree || metadataDisagree) && (
        <p className={styles.notice}>
          Sources disagree about metadata or a hosting relationship. Inspect the source records
          below.
        </p>
      )}
      <dl>
        <div>
          <dt>Observed seeders</dt>
          <dd>{repo.observedSeederCount} in the current window</dd>
        </div>
        <div>
          <dt>First observed</dt>
          <dd>{dateLabel(repo.firstObservedAt)}</dd>
        </div>
        <div>
          <dt>Last observed</dt>
          <dd>{dateLabel(repo.lastObservedAt)}</dd>
        </div>
        <div>
          <dt>Default branch</dt>
          <dd>{repo.branch ?? 'Not available'}</dd>
        </div>
        <div>
          <dt>Metadata source / retrieval</dt>
          <dd>
            {repo.metadataSource ?? 'None'} · {dateLabel(repo.metadataRetrievedAt)}
          </dd>
        </div>
        <div>
          <dt>Delegates (project metadata)</dt>
          <dd>{repo.delegates.length ? repo.delegates.join(', ') : 'Not available'}</dd>
        </div>
      </dl>
      <section className={styles.detailSection} aria-label="Clone command">
        <h4>Clone this RID</h4>
        <p>This command is shown for you to run elsewhere; ratlas never runs it.</p>
        <code className={styles.command}>{command}</code>
        <button type="button" onClick={() => void copy()}>
          Copy clone command
        </button>
        {copyState === 'copied' && <p role="status">Command copied by the browser.</p>}
        {copyState === 'manual' && (
          <p role="status">Clipboard unavailable. Select and copy the command above manually.</p>
        )}
      </section>
      <section className={styles.detailSection} aria-label="Browse links">
        <h4>Browse source</h4>
        {repo.browseTargets
          .filter((target) => safeBrowseUrl(target.url))
          .map((target) => (
            <a
              key={target.url}
              href={safeBrowseUrl(target.url)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {target.label} ↗
            </a>
          ))}
        {!repo.browseTargets.some((target) => safeBrowseUrl(target.url)) && (
          <p>No configured explorer link for this repository.</p>
        )}
      </section>
      <section className={styles.detailSection} aria-label="Metadata variants">
        <h4>Metadata by source</h4>
        {repo.metadataVariants.length ? (
          repo.metadataVariants.map((variant) => (
            <div className={styles.record} key={variant.sourceId}>
              <strong>{variant.sourceId}</strong> · {variant.name ?? 'Name unresolved'}
              <span>Description: {variant.description ?? 'Not available'}</span>
              <span>Branch: {variant.branch ?? 'Not available'}</span>
              <span>
                Delegates:{' '}
                {variant.delegates.length ? variant.delegates.join(', ') : 'Not available'}
              </span>
              <span>Retrieved: {dateLabel(variant.retrievedAt)}</span>
              <span>Revision: {variant.revision ?? 'Not recorded'}</span>
            </div>
          ))
        ) : (
          <p>No public metadata is available.</p>
        )}
      </section>
      <section className={styles.detailSection} aria-label="Repository provenance">
        <h4>Repository observation sources</h4>
        {repo.provenance.map((item) => (
          <div className={styles.record} key={item.sourceId}>
            <strong>{item.sourceId}</strong>
            <span>First observed: {dateLabel(item.firstObservedAt)}</span>
            <span>Last source read: {dateLabel(item.lastObservedAt)}</span>
            {item.observerNid && (
              <span>
                Observer: <code>{item.observerNid}</code>
              </span>
            )}
          </div>
        ))}
      </section>
      <section className={styles.detailSection} aria-label="Observed seeders">
        <h4>Observed seeders · {seeders?.total ?? repo.observedSeederCount}</h4>
        {seedersPending && <p role="status">Loading seeders…</p>}
        {seedersError && (
          <p role="alert">
            Seeder evidence could not be loaded. Cached repository details remain visible.
          </p>
        )}
        <ul className={styles.related}>
          {seeders?.items.map((item) => (
            <li key={item.nid}>
              <button type="button" onClick={() => onSelect({ kind: 'node', id: item.nid })}>
                [node] {conciseId(item.nid)}
              </button>
              {item.sourcesDisagree && <span className={styles.disagreement}>Source conflict</span>}
              <Evidence evidence={item.evidence} />
            </li>
          ))}
        </ul>
        <Pagination page={page} total={seeders?.total ?? 0} limit={25} onPage={onPage} />
      </section>
    </div>
  );
}

function NodeDetail({
  node,
  repos,
  reposPending,
  reposError,
  page,
  onPage,
  onSelect,
}: {
  node: Node;
  repos: z.infer<typeof nodeReposSchema> | undefined;
  reposPending: boolean;
  reposError: boolean;
  page: number;
  onPage: (page: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className={styles.detailBody}>
      <span className={styles.eyebrow}>[node] Radicle node identity</span>
      <h3>{node.alias ?? 'Alias unavailable'}</h3>
      <code className={styles.fullId}>{node.nid}</code>
      <p>Observed relationships describe source evidence, not whether this node is online.</p>
      <dl>
        <div>
          <dt>Observed repositories</dt>
          <dd>{node.observedRepositoryCount} in the current window</dd>
        </div>
        <div>
          <dt>First observed</dt>
          <dd>{dateLabel(node.firstObservedAt)}</dd>
        </div>
        <div>
          <dt>Last source read</dt>
          <dd>{dateLabel(node.lastObservedAt)}</dd>
        </div>
        <div>
          <dt>Alias source</dt>
          <dd>{node.aliasSource ?? 'Not available'}</dd>
        </div>
        <div>
          <dt>Evidence sources</dt>
          <dd>{node.evidenceSources.join(', ') || 'None'}</dd>
        </div>
      </dl>
      <section className={styles.detailSection} aria-label="Node repositories">
        <h4>Repositories on this node · {repos?.total ?? node.observedRepositoryCount}</h4>
        {reposPending && <p role="status">Loading related repositories…</p>}
        {reposError && (
          <p role="alert">
            Related repositories could not be loaded. Cached node details remain visible.
          </p>
        )}
        <ul className={styles.related}>
          {repos?.items.map((item) => (
            <li key={item.rid}>
              <button type="button" onClick={() => onSelect({ kind: 'repo', id: item.rid })}>
                [repo] {item.name ?? conciseId(item.rid)}
              </button>
              <span>
                {item.metadataStatus === 'unresolved' ? 'Metadata unresolved' : item.description}
              </span>
              {item.relationship.sourcesDisagree && (
                <span className={styles.disagreement}>Source conflict</span>
              )}
              <Evidence evidence={item.relationship.evidence} />
            </li>
          ))}
        </ul>
        <Pagination page={page} total={repos?.total ?? 0} limit={25} onPage={onPage} />
      </section>
    </div>
  );
}

function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  if (total <= limit && page === 0) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className={styles.pagination} aria-label="Pages">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page + 1} of {pages}
      </span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function App() {
  const [params, setParams] = useSearchParams();
  const state = readExploreState(params);
  const primaryView = params.get('view') === 'activity' ? 'activity' : 'explore';
  const [searchInput, setSearchInput] = useState(state.q);
  const [mobileTab, setMobileTab] = useState<'list' | 'map' | 'details'>('list');
  const [listCollapsed, setListCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [relatedPage, setRelatedPage] = useState(0);
  const [randomError, setRandomError] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setSearchInput(state.q);
  }, [state.q]);
  useEffect(() => {
    if (searchInput === state.q) return;
    const timer = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (searchInput) next.set('q', searchInput);
        else next.delete('q');
        next.delete('page');
        return next;
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, state.q, setParams]);
  useEffect(() => {
    setRelatedPage(0);
  }, [state.selected?.id]);
  useEffect(() => {
    if (mobileTab === 'details' && state.selected) detailHeading.current?.focus();
  }, [mobileTab, state.selected?.id]);

  function setParam(key: string, value: string, resetPage = true) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (resetPage) next.delete('page');
      return next;
    });
  }
  function select(selection: Selection) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('selected', `${selection.kind}:${selection.id}`);
      next.delete('view');
      return next;
    });
    setMobileTab('details');
    setDetailsCollapsed(false);
  }
  const filters = filterParams(state);
  const graphFilters = filters.toString();
  const catalogQuery = catalogParams(state).toString();
  const relatedQuery = catalogParams(state, relatedPage, false).toString();
  const detailQuery = filterParams(state, false).toString();
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: async ({ signal }) =>
      fullSummarySchema.parse(await getJson('/api/v1/summary', signal)),
    refetchInterval: 15_000,
  });
  const catalog = useQuery({
    queryKey: ['catalog', catalogQuery, summary.data?.datasetRevision, summary.data?.windowBucket],
    queryFn: async ({ signal }) =>
      catalogSchema.parse(await getJson(`/api/v1/repos?${catalogQuery}`, signal)),
    placeholderData: keepPreviousData,
  });
  const repo = useQuery({
    queryKey: [
      'repo',
      state.selected?.kind,
      state.selected?.id,
      detailQuery,
      summary.data?.datasetRevision,
      summary.data?.windowBucket,
    ],
    enabled: state.selected?.kind === 'repo',
    queryFn: async ({ signal }) =>
      repoDetailSchema.parse(
        await getJson(
          `/api/v1/repos/${encodeURIComponent(state.selected!.id)}?${detailQuery}`,
          signal,
        ),
      ),
  });
  const node = useQuery({
    queryKey: [
      'node',
      state.selected?.kind,
      state.selected?.id,
      detailQuery,
      summary.data?.datasetRevision,
      summary.data?.windowBucket,
    ],
    enabled: state.selected?.kind === 'node',
    queryFn: async ({ signal }) =>
      nodeDetailSchema.parse(
        await getJson(
          `/api/v1/nodes/${encodeURIComponent(state.selected!.id)}?${detailQuery}`,
          signal,
        ),
      ),
  });
  const seeders = useQuery({
    queryKey: [
      'seeders',
      state.selected?.id,
      relatedQuery,
      summary.data?.datasetRevision,
      summary.data?.windowBucket,
    ],
    enabled: state.selected?.kind === 'repo' && !!repo.data,
    queryFn: async ({ signal }) =>
      seedersSchema.parse(
        await getJson(
          `/api/v1/repos/${encodeURIComponent(state.selected!.id)}/seeders?${relatedQuery}`,
          signal,
        ),
      ),
  });
  const nodeRepos = useQuery({
    queryKey: [
      'node-repos',
      state.selected?.id,
      relatedQuery,
      summary.data?.datasetRevision,
      summary.data?.windowBucket,
    ],
    enabled: state.selected?.kind === 'node' && !!node.data,
    queryFn: async ({ signal }) =>
      nodeReposSchema.parse(
        await getJson(
          `/api/v1/nodes/${encodeURIComponent(state.selected!.id)}/repos?${relatedQuery}`,
          signal,
        ),
      ),
  });
  async function chooseRandom() {
    setRandomError(null);
    try {
      const result = randomRepoSchema.parse(await getJson(`/api/v1/repos/random?${filters}`));
      if (result.item) select({ kind: 'repo', id: result.item.rid });
      else setRandomError('No repository matches the active filters.');
    } catch {
      setRandomError('Random selection is unavailable. Try again when the data service recovers.');
    }
  }
  const info = summary.data;
  const sourceOptions = info?.coverage.sources ?? [];
  const noFilters =
    !state.q &&
    state.metadata === 'all' &&
    state.minSeeders === 0 &&
    state.maxSeeders === 2_000_000 &&
    !state.sources.length &&
    state.window === '24h';
  return (
    <div className={styles.app}>
      <a
        className={styles.skip}
        href={primaryView === 'activity' ? '#activity-view' : '#repository-list'}
      >
        Skip to {primaryView === 'activity' ? 'activity' : 'repositories'}
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>
            <span className={styles.mark} aria-hidden="true">
              r.
            </span>
            <h1>ratlas</h1>
          </div>
          <section className={styles.headerStats} aria-label="Dataset summary">
            {(
              [
                ['repos', info?.repositories],
                ['nodes', info?.nodeIdentities],
                ['relationships', info?.hostingRelationships],
                ['sources', info?.evidenceSources],
              ] as const
            ).map(([label, value]) => (
              <span key={label}>
                <strong>{value ?? '—'}</strong> {label}
              </span>
            ))}
          </section>
        </div>
        <label className={styles.searchLabel}>
          <span className={styles.searchHeading}>
            <span>Search public repositories</span>
            <strong className={styles.datasetMode}>
              {info?.mode === 'demo'
                ? 'Synthetic demo data'
                : info?.mode === 'live'
                  ? 'Live dataset'
                  : 'Checking dataset mode…'}
            </strong>
          </span>
          <input
            type="search"
            aria-label="Search public repositories"
            value={searchInput}
            maxLength={200}
            placeholder="Name, description, or exact RID"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
      </header>
      <nav className={styles.viewBar} aria-label="Primary views">
        <button
          type="button"
          aria-current={primaryView === 'explore' ? 'page' : undefined}
          onClick={() => setParam('view', '', false)}
        >
          Explore
        </button>
        <button
          type="button"
          aria-current={primaryView === 'activity' ? 'page' : undefined}
          onClick={() => setParam('view', 'activity', false)}
        >
          Activity
        </button>
      </nav>
      <main>
        {(summary.isError || catalog.isError) && (
          <div role="alert" className={styles.error}>
            {info || catalog.data
              ? 'The data service is unavailable; last loaded observations remain visible.'
              : 'The data service is unavailable. No dataset is available yet.'}
            <button
              type="button"
              onClick={() => {
                void summary.refetch();
                void catalog.refetch();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {info &&
          (info.coverage.collectionStatus === 'degraded' ||
            info.coverage.collectionStatus === 'unconfigured' ||
            sourceOptions.some((source) => source.error)) && (
            <div role="status" className={styles.warning}>
              {sourceState(info)}.{' '}
              {info.repositories
                ? `Cached observations remain available; last source snapshot ${dateLabel(
                    sourceOptions
                      .map((source) => source.lastCompleteSnapshot)
                      .filter(Boolean)
                      .sort()
                      .at(-1),
                  )}.`
                : 'No public observations are available.'}
            </div>
          )}
        {primaryView === 'activity' ? (
          <ActivityView
            summary={info}
            window={state.window}
            onWindowChange={(value) => setParam('window', value === '24h' ? '' : value)}
            onSelect={select}
          />
        ) : (
          <>
            <nav className={styles.mobileTabs} aria-label="Workspace tabs">
              {(['list', 'map', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-current={mobileTab === tab ? 'page' : undefined}
                  onClick={() => setMobileTab(tab)}
                >
                  {tab[0]!.toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
            <div
              className={styles.workspace}
              style={{
                gridTemplateColumns: `${listCollapsed ? 46 : 320}px minmax(0, 1fr) ${detailsCollapsed ? 46 : 360}px`,
              }}
            >
              <section
                className={styles.catalog}
                id="repository-list"
                tabIndex={-1}
                aria-label="Repository list"
                data-active={mobileTab === 'list'}
                data-collapsed={listCollapsed}
              >
                <div className={styles.paneHeading}>
                  <h2>Repositories</h2>
                  <button
                    type="button"
                    className={styles.collapse}
                    aria-label={
                      listCollapsed ? 'Expand repository list' : 'Collapse repository list'
                    }
                    aria-expanded={!listCollapsed}
                    onClick={() => setListCollapsed(!listCollapsed)}
                  >
                    {listCollapsed ? '›' : '‹'}
                  </button>
                </div>
                {!listCollapsed && (
                  <>
                    <div className={styles.filters}>
                      <label>
                        Metadata
                        <select
                          value={state.metadata}
                          onChange={(event) =>
                            setParam(
                              'metadata',
                              event.target.value === 'all' ? '' : event.target.value,
                            )
                          }
                        >
                          <option value="all">All metadata</option>
                          <option value="resolved">Resolved</option>
                          <option value="unresolved">Unresolved</option>
                        </select>
                      </label>
                      <label>
                        Observation window
                        <select
                          value={state.window}
                          onChange={(event) =>
                            setParam(
                              'window',
                              event.target.value === '24h' ? '' : event.target.value,
                            )
                          }
                        >
                          <option value="24h">Last 24 hours</option>
                          <option value="7d">Last 7 days</option>
                          <option value="all">All retained</option>
                        </select>
                      </label>
                      <div className={styles.range}>
                        <label>
                          Minimum seeders
                          <input
                            type="number"
                            min="0"
                            max="2000000"
                            value={state.minSeeders}
                            onChange={(event) =>
                              setParam(
                                'minSeeders',
                                event.target.value === '0' ? '' : event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          Maximum seeders
                          <input
                            type="number"
                            min="0"
                            max="2000000"
                            value={state.maxSeeders === 2_000_000 ? '' : state.maxSeeders}
                            placeholder="Any"
                            onChange={(event) => setParam('maxSeeders', event.target.value)}
                          />
                        </label>
                      </div>
                      <fieldset>
                        <legend>Evidence sources</legend>
                        {sourceOptions.length ? (
                          sourceOptions.map((source) => (
                            <label key={source.id} className={styles.check}>
                              <input
                                type="checkbox"
                                checked={state.sources.includes(source.id)}
                                onChange={(event) =>
                                  setParam(
                                    'source',
                                    (event.target.checked
                                      ? [...state.sources, source.id]
                                      : state.sources.filter((id) => id !== source.id)
                                    )
                                      .sort()
                                      .join(','),
                                  )
                                }
                              />
                              {source.label}
                            </label>
                          ))
                        ) : (
                          <span>No sources configured</span>
                        )}
                      </fieldset>
                      <div className={styles.range}>
                        <label>
                          Sort by
                          <select
                            value={state.sort}
                            onChange={(event) =>
                              setParam(
                                'sort',
                                event.target.value === 'name' ? '' : event.target.value,
                              )
                            }
                          >
                            <option value="name">Name</option>
                            <option value="firstObserved">First observed</option>
                            <option value="seeders">Observed seeders</option>
                          </select>
                        </label>
                        <label>
                          Order
                          <select
                            value={state.order}
                            onChange={(event) =>
                              setParam(
                                'order',
                                event.target.value === 'asc' ? '' : event.target.value,
                              )
                            }
                          >
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                          </select>
                        </label>
                      </div>
                      <div className={styles.filterActions}>
                        <button type="button" onClick={() => void chooseRandom()}>
                          Random repository
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setParams((current) => {
                              const next = new URLSearchParams();
                              const selected = current.get('selected');
                              if (selected) next.set('selected', selected);
                              return next;
                            })
                          }
                        >
                          Clear filters
                        </button>
                      </div>
                      {randomError && <p role="status">{randomError}</p>}
                    </div>
                    <div className={styles.resultHeading}>
                      <strong>
                        {catalog.data?.total ?? '—'}{' '}
                        {catalog.isPlaceholderData ? 'previous results' : 'results'}
                      </strong>
                      <span>{state.window} window</span>
                    </div>
                    {catalog.isPending && (
                      <p role="status" className={styles.empty}>
                        Loading repositories…
                      </p>
                    )}
                    {catalog.data?.items.length === 0 && (
                      <p className={styles.empty}>
                        {info?.repositories === 0
                          ? 'No public repositories observed yet.'
                          : noFilters
                            ? 'No repositories in this observation window.'
                            : 'No repositories match these filters.'}
                      </p>
                    )}
                    <ul className={styles.list}>
                      {catalog.data?.items.map((item) => (
                        <li key={item.rid}>
                          <button
                            type="button"
                            className={styles.repoButton}
                            aria-current={
                              state.selected?.kind === 'repo' && state.selected.id === item.rid
                                ? 'true'
                                : undefined
                            }
                            onClick={() => select({ kind: 'repo', id: item.rid })}
                          >
                            <span className={styles.repoTop}>
                              <span>[repo]</span>
                              <span>{item.observedSeederCount} observed seeders</span>
                            </span>
                            <strong>{item.name ?? 'Name unresolved'}</strong>
                            <code title={item.rid}>{conciseId(item.rid)}</code>
                            <span>{item.description ?? 'No public description available.'}</span>
                            <small>
                              {item.metadataStatus === 'unresolved'
                                ? 'Metadata unresolved'
                                : `Metadata: ${item.metadataSource ?? 'unknown'}`}{' '}
                              · Last observed {dateLabel(item.lastObservedAt)}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Pagination
                      page={state.page}
                      total={catalog.data?.total ?? 0}
                      limit={25}
                      onPage={(page) => setParam('page', page ? String(page) : '', false)}
                    />
                  </>
                )}
              </section>
              <GraphMap
                filterQuery={graphFilters}
                selected={state.selected}
                datasetRevision={info?.datasetRevision}
                windowBucket={info?.windowBucket}
                active={mobileTab === 'map'}
                onSelect={select}
                onClearSelection={() => setParam('selected', '', false)}
              />
              <aside
                className={styles.details}
                aria-label="Details"
                data-active={mobileTab === 'details'}
                data-collapsed={detailsCollapsed}
              >
                <div className={styles.paneHeading}>
                  <h2 ref={detailHeading} tabIndex={-1}>
                    {state.selected
                      ? state.selected.kind === 'repo'
                        ? 'Repository details'
                        : 'Node details'
                      : 'About this dataset'}
                  </h2>
                  <button
                    type="button"
                    className={styles.collapse}
                    aria-label={detailsCollapsed ? 'Expand details' : 'Collapse details'}
                    aria-expanded={!detailsCollapsed}
                    onClick={() => setDetailsCollapsed(!detailsCollapsed)}
                  >
                    {detailsCollapsed ? '‹' : '›'}
                  </button>
                </div>
                {!detailsCollapsed &&
                  (state.invalidSelection ? (
                    <p role="alert" className={styles.empty}>
                      Invalid selected ID in the URL. Choose an entity from the list.
                    </p>
                  ) : !state.selected ? (
                    <EmptyDetail info={info} />
                  ) : state.selected.kind === 'repo' ? (
                    repo.isPending ? (
                      <p role="status" className={styles.empty}>
                        Loading repository details…
                      </p>
                    ) : repo.data ? (
                      <RepoDetail
                        key={repo.data.rid}
                        repo={repo.data}
                        seeders={seeders.data}
                        seedersPending={seeders.isPending}
                        seedersError={seeders.isError}
                        page={relatedPage}
                        onPage={setRelatedPage}
                        onSelect={select}
                      />
                    ) : (
                      <p role="alert" className={styles.empty}>
                        Repository details are unavailable or outside the active filters. Choose
                        another result.
                      </p>
                    )
                  ) : node.isPending ? (
                    <p role="status" className={styles.empty}>
                      Loading node details…
                    </p>
                  ) : node.data ? (
                    <NodeDetail
                      node={node.data}
                      repos={nodeRepos.data}
                      reposPending={nodeRepos.isPending}
                      reposError={nodeRepos.isError}
                      page={relatedPage}
                      onPage={setRelatedPage}
                      onSelect={select}
                    />
                  ) : (
                    <p role="alert" className={styles.empty}>
                      Node details are unavailable or outside the active filters. Choose another
                      result.
                    </p>
                  ))}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
