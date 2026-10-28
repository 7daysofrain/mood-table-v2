/**
 * Los valores que muestran los controles de una tira (decisión 2 del change strip-effect-values):
 * en reposo, los que pinta el motor, como dice D82; mientras el DJ arrastra un control, los suyos.
 * El valor local dura desde el primer cambio hasta que, tras soltar, la tira no tiene ningún envío
 * de valores en camino ni pendiente: así el eco atrasado del motor no hace temblar el control bajo
 * el dedo, y al soltar no salta atrás al valor anterior. Si el motor no aplica el valor, el control
 * acaba en el que pinta.
 */
import type { SetValuesBody, StripState } from '@moodtable/shared';
import { useEffect, useState } from 'react';

import type { StripRequests } from '../engine/strip-requests.ts';

/** Lo que los controles usan de la cola de valores: así los tests pueden darle una falsa. */
export type ValueRequests = Pick<StripRequests<SetValuesBody>, 'send' | 'busy' | 'subscribe'>;

/** Los valores locales de la tira que el DJ está tocando. */
interface Draft {
  stripId: string;
  values: Record<string, unknown>;
  /** Hasta que suelta el control. */
  dragging: boolean;
}

export function useDraftValues(strip: StripState | undefined, requests: ValueRequests) {
  const [draft, setDraft] = useState<Draft>();

  // Al vaciarse la cola de la tira, si el DJ ya ha soltado, vuelve a mandar el motor.
  useEffect(
    () =>
      requests.subscribe(() => {
        setDraft((current) =>
          current && !current.dragging && !requests.busy(current.stripId) ? undefined : current,
        );
      }),
    [requests],
  );

  // Los valores de cualquier efecto son un objeto con un campo por parámetro.
  const engineValues = strip?.values as Record<string, unknown> | undefined;
  const values = draft && draft.stripId === strip?.id ? draft.values : engineValues;

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
      return requests.busy(current.stripId) ? { ...current, dragging: false } : undefined;
    });
  };

  return { values, change, release };
}
