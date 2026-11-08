/**
 * Tests de contrato del puerto `StateStore` (README §3, *cómo se prueba la persistencia*): el mismo
 * conjunto corre contra cada adaptador, así que el núcleo puede probarse con el de memoria y fiarse
 * de que el de SQLite hace lo mismo.
 *
 * Vive en `test/` y no en `src/`: es código de test, así que ni la cobertura ni SonarQube lo cuentan
 * como del producto. No es un `.test.ts` porque no tiene tests propios: los registra cada adaptador.
 */
import { describe, expect, it } from 'vitest';

import type { InstrumentState, StateStore } from '../src/core/state-store.ts';

/** Un estado que el test puede cambiar después de guardarlo o de leerlo. */
type Editable = Record<string, { activeEffect: string; values: Record<string, unknown> }>;

const azul = { color: '#0000ff', period: 8 };

const mesa: InstrumentState = {
  mesa: { activeEffect: 'breathing', values: { breathing: azul, energy: {} } },
};

/** `create` da un almacén nuevo, sin nada guardado, en cada test. */
export function describeStateStoreContract(name: string, create: () => StateStore): void {
  describe(`${name}: contrato de StateStore`, () => {
    it('sin nada guardado, devuelve un estado vacío', () => {
      expect(create().load()).toEqual({});
    });

    it('devuelve lo que se ha guardado', () => {
      const store = create();
      store.save(mesa);

      expect(store.load()).toEqual(mesa);
    });

    it('un guardado sustituye el efecto activo y los valores que lleva', () => {
      const store = create();
      store.save(mesa);
      const after = { breathing: { ...azul, period: 2 }, energy: {} };
      store.save({ mesa: { activeEffect: 'energy', values: after } });

      expect(store.load()).toEqual({ mesa: { activeEffect: 'energy', values: after } });
    });

    it('un guardado no borra las tiras que no lleva', () => {
      const store = create();
      store.save(mesa);
      store.save({ ambiente: { activeEffect: 'energy', values: { energy: {} } } });

      expect(store.load()).toEqual({
        ...mesa,
        ambiente: { activeEffect: 'energy', values: { energy: {} } },
      });
    });

    it('un guardado no borra los valores de los efectos que no lleva', () => {
      const store = create();
      const retirado = { breathing: azul, retirado: { x: 1 } };
      store.save({ mesa: { activeEffect: 'breathing', values: retirado } });
      store.save({ mesa: { activeEffect: 'breathing', values: { breathing: azul } } });

      expect(store.load()).toEqual({ mesa: { activeEffect: 'breathing', values: retirado } });
    });

    it('lo que haga después quien guarda o quien lee no cambia lo guardado', () => {
      const store = create();
      const state: Editable = structuredClone(mesa);
      store.save(state);
      state.mesa = { activeEffect: 'energy', values: { energy: {} } };
      const loaded: Editable = store.load();
      loaded.mesa = { activeEffect: 'energy', values: { energy: {} } };

      expect(store.load()).toEqual(mesa);
    });

    it('conserva una tira cuyo id coincide con una propiedad de Object, como __proto__', () => {
      const store = create();
      // Con JSON.parse, `__proto__` es una propiedad propia, como la que daría el fichero.
      const state = JSON.parse(
        '{"__proto__": {"activeEffect": "breathing", "values": {"breathing": {"period": 4}}}}',
      ) as InstrumentState;
      store.save(state);
      const loaded = store.load();

      expect(Object.keys(loaded)).toEqual(['__proto__']);
      expect(Object.getOwnPropertyDescriptor(loaded, '__proto__')?.value).toEqual({
        activeEffect: 'breathing',
        values: { breathing: { period: 4 } },
      });
    });
  });
}
