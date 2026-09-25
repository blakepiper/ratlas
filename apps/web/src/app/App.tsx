import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { repoListSchema, summarySchema } from '@ratlas/core';
import styles from './App.module.css';

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error('The local data service could not complete this request.');
  return response.json();
}
function initialTheme() {
  try {
    return localStorage.getItem('ratlas.theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
export function App() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ratlas.theme', theme);
    } catch {
      /* Theme remains available for this session. */
    }
  }, [theme]);
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: async ({ signal }) => summarySchema.parse(await getJson('/api/v1/summary', signal)),
  });
  const repos = useQuery({
    queryKey: ['repositories', summary.data?.datasetRevision],
    queryFn: async ({ signal }) =>
      repoListSchema.parse(await getJson('/api/v1/repos?limit=100', signal)),
  });
  const info = summary.data;
  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#repository-list">
        Skip to repositories
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            r.
          </span>
          <h1>ratlas</h1>
          <span className={styles.subtitle}>public repository observations</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.stage}>Foundation · R1</span>
          <button
            className={styles.theme}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </header>
      <div className={styles.modeBar}>
        <strong>
          {info?.mode === 'demo'
            ? 'Synthetic demo data'
            : info?.mode === 'live'
              ? 'Live dataset'
              : 'Checking dataset mode…'}
        </strong>
        <span>
          {info?.mode === 'demo'
            ? 'Deterministic fixtures · no live collection'
            : 'No collector is started by this interface'}
        </span>
      </div>
      <div className={styles.viewBar}>
        <span className={styles.current}>Explore</span>
        <span>
          Map <small>not implemented</small>
        </span>
        <span>
          Activity <small>not implemented</small>
        </span>
        <span className={styles.window}>Observed within 24 hours</span>
      </div>
      <main>
        <section className={styles.summary} aria-label="Dataset summary">
          {[
            ['Repositories', info?.repositories],
            ['Node identities', info?.nodeIdentities],
            ['Hosting relationships', info?.hostingRelationships],
            ['Evidence sources', info?.evidenceSources],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span className={styles.metric}>{value ?? '—'}</span>
              <span>{label}</span>
            </div>
          ))}
        </section>
        {(summary.isError || repos.isError) && (
          <div role="alert" className={styles.error}>
            The local data service is unavailable.{' '}
            {info ? 'Showing the last loaded summary.' : 'No dataset is available yet.'}
            <button
              onClick={() => {
                void summary.refetch();
                void repos.refetch();
              }}
            >
              Retry
            </button>
          </div>
        )}
        <div className={styles.workspace}>
          <section
            className={styles.catalog}
            id="repository-list"
            tabIndex={-1}
            aria-label="Repository list"
          >
            <div className={styles.paneHeading}>
              <h2>Repositories</h2>
              <span>{repos.data?.total ?? '—'} observed</span>
            </div>
            <p className={styles.listNote}>Names where available. IDs always preserved.</p>
            {repos.isPending ? (
              <p role="status" className={styles.empty}>
                Loading repositories…
              </p>
            ) : repos.data?.items.length === 0 ? (
              <p className={styles.empty}>No public repositories observed yet.</p>
            ) : null}
            <ul className={styles.list}>
              {repos.data?.items.map((repo) => (
                <li key={repo.rid}>
                  <div className={styles.repoTop}>
                    <span className={styles.repoType}>[repo]</span>
                    <span className={styles.count}>
                      {repo.observedSeederCount} observed seeders
                    </span>
                  </div>
                  <h3>{repo.name ?? 'Name unresolved'}</h3>
                  <code title={repo.rid}>{repo.rid}</code>
                  <p>
                    {repo.description ??
                      'Public provenance is available; project metadata is missing.'}
                  </p>
                  {!repo.name && <span className={styles.unresolved}>Metadata unresolved</span>}
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.map} aria-labelledby="map-heading">
            <div className={styles.paneHeading}>
              <h2 id="map-heading">Relationship map</h2>
              <span>Stage D</span>
            </div>
            <div className={styles.mapMessage}>
              <span className={styles.mapSymbol} aria-hidden="true">
                [repo] — [node]
              </span>
              <h3>The map is not implemented yet</h3>
              <p>
                This foundation connects the catalog to stored observations. Graph exploration comes
                after data and browsing review.
              </p>
              <span className={styles.later}>No graph or layout simulation is running</span>
            </div>
            <div className={styles.mapFooter}>
              A hosting relationship describes source evidence, not verified availability.
            </div>
          </section>
          <aside className={styles.details} aria-label="About these observations">
            <div className={styles.paneHeading}>
              <h2>About this dataset</h2>
            </div>
            <div className={styles.detailBody}>
              <span className={styles.eyebrow}>Observation coverage</span>
              <h3>A view of the evidence</h3>
              <p>
                Counts describe repositories and node identities observed by this installation. They
                do not describe the whole network.
              </p>
              <dl>
                <div>
                  <dt>Project metadata</dt>
                  <dd>
                    {info ? info.repositories - info.unresolvedMetadata : '—'} resolved ·{' '}
                    {info?.unresolvedMetadata ?? '—'} unresolved
                  </dd>
                </div>
                <div>
                  <dt>Observation window</dt>
                  <dd>24 hours of source observations</dd>
                </div>
                <div>
                  <dt>{info?.mode === 'demo' ? 'Demo reference clock' : 'Query reference time'}</dt>
                  <dd>
                    {info
                      ? new Date(info.referenceTime)
                          .toISOString()
                          .replace('T', ' ')
                          .replace('.000Z', ' UTC')
                      : 'Not loaded'}
                  </dd>
                </div>
                <div>
                  <dt>Announcement age</dt>
                  <dd>Separate from source-read freshness</dd>
                </div>
              </dl>
              <div className={styles.scope}>
                <strong>Next review stages</strong>
                <p>
                  Search, filters, repository details, source health, and activity are not
                  implemented yet.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <footer className={styles.footer}>
        <span>ratlas · read-only observation browser</span>
        <span>
          {info?.mode === 'demo' ? 'Synthetic identities and observations' : 'Public evidence only'}{' '}
          · no replication commands
        </span>
      </footer>
    </div>
  );
}
