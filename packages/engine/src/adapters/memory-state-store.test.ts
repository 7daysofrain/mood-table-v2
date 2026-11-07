import { describeStateStoreContract } from '../core/state-store.contract.ts';
import { createMemoryStateStore } from './memory-state-store.ts';

describeStateStoreContract('el adaptador en memoria', () => createMemoryStateStore());
