import type { Config } from '@ratlas/core';
import { parseEvent } from '@ratlas/radicle';
import { observe, storeAlias, type Db } from '@ratlas/db';
import { observerEvent } from './observer-publication.js';

export function applyPendingEvents(db: Db, config: Config) {
  const pending = db
    .prepare(
      'SELECT * FROM collector_events WHERE applied=0 ORDER BY observed_at,session_id,sequence',
    )
    .all() as { id: string; source_id: string; observed_at: number; normalized_event: string }[];
  for (const entry of pending)
    db.transaction(() => {
      const parsed = parseEvent(JSON.parse(entry.normalized_event));
      const event =
        entry.source_id === 'local-observer' ? observerEvent(db, config, parsed) : parsed;
      if (event?.type === 'inventoryAnnounced') {
        for (const rid of new Set(event.inventory))
          observe(
            db,
            {
              id: entry.id + ':' + rid,
              sourceId: entry.source_id,
              rid,
              nid: event.nid,
              kind: 'present',
              observedAt: entry.observed_at,
              announcedAt: event.timestamp,
              evidence: 'inventory',
            },
            null,
            config.collection.clockSkewMs,
          );
      } else if (event?.type === 'nodeAnnounced')
        storeAlias(
          db,
          entry.source_id,
          event.nid,
          event.alias,
          entry.observed_at,
          event.timestamp,
          config.collection.clockSkewMs,
        );
      else if (event)
        observe(
          db,
          {
            id: entry.id,
            sourceId: entry.source_id,
            rid: event.rid,
            nid: event.nid,
            kind: event.type === 'seedDropped' ? 'missing' : 'present',
            observedAt: entry.observed_at,
          },
          null,
          config.collection.clockSkewMs,
        );
      db.prepare('UPDATE collector_events SET applied=1 WHERE id=?').run(entry.id);
      db.prepare(
        'UPDATE source_health SET last_event=?,event_stream_status=? WHERE source_id=?',
      ).run(entry.observed_at, 'connected', entry.source_id);
    })();
  // Idempotency lives in observations; do not retain full repeated inventory payloads.
  db.prepare('DELETE FROM collector_events WHERE applied=1').run();
}
export function fullJitter(attempt: number, base: number, cap: number, random = Math.random) {
  return Math.floor(random() * Math.min(cap, base * 2 ** Math.min(attempt, 30)));
}
export function retryAfterTime(
  value: string | null,
  now: number,
  maximum: number,
): { at: number; paused: boolean } | null {
  if (!value) return null;
  const time = /^\d+$/u.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return { at: Math.max(now, time), paused: time - now > maximum };
}
