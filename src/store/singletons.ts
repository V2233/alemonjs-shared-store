import { getGlobalNs } from '../api/getGlobalNs';
import { config } from '../config';

// #region ---------------- better-sqlite3 全局单例加载 ----------------

type DatabaseConstructor = typeof import('better-sqlite3');

let _dbCtorPromise: Promise<DatabaseConstructor> | null = null;
export async function getGlobalBetterSqlite3(): Promise<DatabaseConstructor> {
  const ns = getGlobalNs();
  if (ns['better-sqlite3-ctor']) return ns['better-sqlite3-ctor'];

  if (!_dbCtorPromise) {
    _dbCtorPromise = import('better-sqlite3').then(
      mod => mod.default as unknown as DatabaseConstructor
    );
  }
  const ctor = await _dbCtorPromise;
  ns['better-sqlite3-ctor'] = ctor;
  return ctor;
}

// #endregion

import { EventStore } from './classes/EventStore';

export function getGlobalEventStore(): EventStore {
  const ns = getGlobalNs();
  if (!ns['event-store']) {
    ns['event-store'] = new EventStore(config.value.eventStore);
    config.onReload(value => {
      (ns['event-store'] as EventStore).updateConfig(value.eventStore);
    });
  }
  return ns['event-store'] as EventStore;
}
