import type { Config } from '@ratlas/core';
import { independentlyPublicRepository, type Db } from '@ratlas/db';
import type { RadicleEvent } from '@ratlas/radicle';

export function observerEvent(db: Db, config: Config, event: RadicleEvent | null) {
  if (!event || !config.localObserverPublicRepositoriesOnly) return event;
  if (event.type === 'inventoryAnnounced') {
    const inventory = event.inventory.filter((rid) => independentlyPublicRepository(db, rid));
    return inventory.length ? { ...event, inventory } : null;
  }
  if (event.type === 'nodeAnnounced')
    return db.prepare('SELECT 1 FROM eligible_routes WHERE nid=? LIMIT 1').get(event.nid)
      ? event
      : null;
  return independentlyPublicRepository(db, event.rid) ? event : null;
}
