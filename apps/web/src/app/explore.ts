import { nidSchema, ridSchema, type CatalogQuery } from '@ratlas/core';

export type Selection = { kind: 'repo' | 'node'; id: string };
export type ExploreState = {
  q: string;
  metadata: CatalogQuery['metadata'];
  minSeeders: number;
  maxSeeders: number;
  window: CatalogQuery['window'];
  sources: string[];
  sort: CatalogQuery['sort'];
  order: CatalogQuery['order'];
  page: number;
  selected: Selection | null;
  invalidSelection: boolean;
};

function boundedNumber(value: string | null, fallback: number, maximum: number) {
  if (!value || !/^\d{1,9}$/u.test(value)) return fallback;
  const parsed = Number(value);
  return parsed <= maximum ? parsed : fallback;
}

export function readExploreState(params: URLSearchParams): ExploreState {
  const rawSelection = params.get('selected');
  let selected: Selection | null = null;
  if (rawSelection?.startsWith('repo:') && ridSchema.safeParse(rawSelection.slice(5)).success)
    selected = { kind: 'repo', id: rawSelection.slice(5) };
  if (rawSelection?.startsWith('node:') && nidSchema.safeParse(rawSelection.slice(5)).success)
    selected = { kind: 'node', id: rawSelection.slice(5) };
  const metadata = params.get('metadata');
  const window = params.get('window');
  const sort = params.get('sort');
  const order = params.get('order');
  const minSeeders = boundedNumber(params.get('minSeeders'), 0, 2_000_000);
  const maxSeeders = boundedNumber(params.get('maxSeeders'), 2_000_000, 2_000_000);
  return {
    q: (params.get('q') ?? '').slice(0, 200),
    metadata: metadata === 'resolved' || metadata === 'unresolved' ? metadata : 'all',
    minSeeders,
    maxSeeders: Math.max(maxSeeders, minSeeders),
    window: window === '7d' || window === 'all' ? window : '24h',
    sources: [...new Set((params.get('source') ?? '').split(',').filter(Boolean))]
      .filter((item) => /^[a-zA-Z0-9_-]{1,64}$/u.test(item))
      .slice(0, 64)
      .sort(),
    sort: sort === 'seeders' || sort === 'firstObserved' ? sort : 'name',
    order: order === 'desc' ? 'desc' : 'asc',
    page: boundedNumber(params.get('page'), 0, 1_000),
    selected,
    invalidSelection: !!rawSelection && !selected,
  };
}

export function filterParams(state: ExploreState, includeSearch = true) {
  const params = new URLSearchParams();
  if (includeSearch && state.q) params.set('q', state.q);
  if (state.metadata !== 'all') params.set('metadata', state.metadata);
  if (state.minSeeders) params.set('minSeeders', String(state.minSeeders));
  if (state.maxSeeders !== 2_000_000) params.set('maxSeeders', String(state.maxSeeders));
  if (state.window !== '24h') params.set('window', state.window);
  if (state.sources.length) params.set('source', state.sources.join(','));
  return params;
}

export function catalogParams(state: ExploreState, page = state.page, includeSearch = true) {
  const params = filterParams(state, includeSearch);
  params.set('sort', state.sort);
  params.set('order', state.order);
  params.set('page', String(page));
  params.set('limit', '25');
  return params;
}

export function conciseId(id: string) {
  return id.length > 25 ? `${id.slice(0, 15)}…${id.slice(-8)}` : id;
}

export function dateLabel(value: string | null | undefined) {
  return value
    ? new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
    : 'Not recorded';
}

export function safeBrowseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
