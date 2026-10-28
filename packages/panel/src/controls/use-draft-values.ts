/**
 * Los valores que muestran los controles de una tira (decisión 2 del change strip-effect-values):
 * en reposo, los que pinta el motor, como dice D82; mientras el DJ arrastra un control, los suyos.
 * El valor local dura desde el primer cambio hasta que, tras soltar, la tira no tiene ningún envío
 * de valores en camino ni pendiente y ha llegado el eco del último: así el eco atrasado del motor no
 * hace temblar el control bajo el dedo, y al soltar no salta atrás al valor anterior. Si el motor no
 * aplica el valor, el control acaba en el que pinta.
 */
import type { SetValuesBody, StripState } from '@moodtable/shared';
import { useEffect, useRef, useState } from 'react';

import type { StripRequests } from '../engine/strip-requests.ts';

/** Lo que los controles usan de la cola de valores: así los tests pueden darle una falsa. */
export type ValueRequests = Pick<StripRequests<SetValuesBody>, 'send' | 'busy' | 'subscribe'>;

type Values = Record<string, unknown>;

/** Los valores locales de la tira que el DJ está tocando. */
interface Draft {
  stripId: string;
  values: Values;
  /** Hasta que suelta el control. */
  dragging: boolean;
  /**
   * La cola se vació con el último envío aplicado: los valores que pintaba entonces el motor. El eco
   * viaja por el WebSocket y la respuesta del `PUT` por otra conexión, así que puede llegar después:
   * el valor local dura hasta que la tira traiga otros valores.
   */
  applied?: { over: Values | undefined };
}

export function useDraftValues(strip: StripState | undefined, requests: ValueRequests) {
  const [draft, setDraft] = useState<Draft>();
  // Los valores de cualquier efecto son un objeto con un campo por parámetro.
  const engineValues = strip?.values as Values | undefined;
  const latestEngineValues = useRef(engineValues);
  useEffect(() => {
    latestEngineValues.current = engineValues;
  });

  // Al vaciarse la cola de la tira: si el motor no aplicó el valor y el DJ ya ha soltado, vuelve a
  // mandar el motor; si lo aplicó, a esperar su eco.
  useEffect(
    () =>
      requests.subscribe((stripId, applied) => {
        setDraft((current) => {
          if (current?.stripId !== stripId || requests.busy(stripId)) return current;
          if (!applied) return current.dragging ? current : undefined;
          return { ...current, applied: { over: latestEngineValues.current } };
        });
      }),
    [requests],
  );

  const local =
    draft !== undefined &&
    draft.stripId === strip?.id &&
    (draft.dragging || draft.applied === undefined || draft.applied.over === engineValues);
  const values = local ? draft.values : engineValues;

  /** El DJ mueve el control de `param`: se ve al momento y sale hacia el motor con todos los valores. */
  const change = (param: string, value: unknown) => {
    if (!strip || !values) return;
    const next = { ...values, [param]: value };
    setDraft({ stripId: strip.id, values: next, dragging: true });
    // El motor valida los valores con el esquema del efecto activo (D87).
    requests.send(strip.id, next);
  };

  /** El DJ suelta el control. */
  const release = () => {
    setDraft((current) => {
      if (!current) return current;
      // Sin envíos en camino ni el último aplicado, el motor no lo aplicó.
      if (!requests.busy(current.stripId) && current.applied === undefined) return undefined;
      return { ...current, dragging: false };
    });
  };

  return { values, change, release };
}
