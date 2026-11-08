import { describe, expect, it } from 'vitest';

import { describeStateStoreContract } from '../../test/state-store-contract.ts';
import { createMemoryStateStore } from './memory-state-store.ts';

describeStateStoreContract('el adaptador en memoria', () => createMemoryStateStore());

describe('el adaptador en memoria con un estado inicial', () => {
  it('arranca con ese estado, copiado: cambiarlo después no cambia lo guardado', () => {
    const initial = { cabina: { activeEffect: 'breathing', values: { breathing: { period: 4 } } } };
    const store = createMemoryStateStore(initial);

    initial.cabina.values.breathing.period = 9;

    expect(store.load()).toEqual({
      cabina: { activeEffect: 'breathing', values: { breathing: { period: 4 } } },
    });
  });
});
