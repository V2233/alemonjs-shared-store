import { getGlobalNs } from '../api/getGlobalNs';
import { getGlobalBetterSqlite3, getGlobalEventStore } from './singletons';

const ns = getGlobalNs();

if (!ns['getGlobalEventStore']) {
  ns['getGlobalEventStore'] = getGlobalEventStore;
}

if (!ns['getGlobalBetterSqlite3']) {
  ns['getGlobalBetterSqlite3'] = getGlobalBetterSqlite3;
}

process.on('beforeExit', () => {
  const ns = getGlobalNs();
  const eventStore = ns['event-store'];
  if (eventStore) {
    eventStore.flush();
  }
});
