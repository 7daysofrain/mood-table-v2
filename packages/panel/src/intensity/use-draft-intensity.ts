/**
 * La intensidad que muestra el fader (specs/intensity; decisión 9 del change instrument-intensity),
 * con la regla de `useDraftValues` (D85): en reposo, la que pinta el motor; mientras el DJ arrastra,
 * la suya. El valor local dura desde el primer cambio hasta que, tras soltar, la cola no tiene ningún
 * envío en camino ni pendiente y ha llegado el eco del último: así el eco atrasado del motor no hace
 * temblar el fader bajo el dedo, y al soltar no salta atrás. Si el motor no la aplica, el fader acaba
 * en la intensidad que pinta. El mensaje `7` va en 64 bits, así que el eco se compara por igualdad.
 */
import { useEffect, useRef, useState } from 'react';

import { INTENSITY_KEY, type RequestQueue } from '../engine/request-queue.ts';

/** Lo que el fader usa de la cola de la intensidad: así los tests pueden darle una falsa. */
export type IntensityRequests = Pick<RequestQueue<number>, 'send' | 'busy' | 'subscribe'>;

/** La intensidad local mientras el DJ toca el fader. */
interface Draft {
  value: number;
  /** Hasta que suelta el fader. */
  dragging: boolean;
  /**
   * La cola se vació con el último envío aplicado: la intensidad que pintaba entonces el motor. El
   * eco viaja por el WebSocket y la respuesta del `PUT` por otra conexión, así que puede llegar
   * después: el valor local dura hasta que el motor pinte otra.
   */
  applied?: { over: number | undefined };
}

/** Con dos decimales, como el paso del fader: la API recibe 0,07 y no 0,07000000000000001. */
function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function useDraftIntensity(engine: number | undefined, requests: IntensityRequests) {
  const [draft, setDraft] = useState<Draft>();
  const latestEngine = useRef(engine);
  useEffect(() => {
    latestEngine.current = engine;
  });

  // Al vaciarse la cola: si el motor no la aplicó y el DJ ya ha soltado, vuelve a mandar el motor;
  // si la aplicó, a esperar su eco.
  useEffect(
    () =>
      requests.subscribe((key, applied) => {
        setDraft((current) => {
          if (!current || requests.busy(key)) return current;
          if (!applied) return current.dragging ? current : undefined;
          return { ...current, applied: { over: latestEngine.current } };
        });
      }),
    [requests],
  );

  // Sin conexión no hay fader: un valor local de antes no vale para el motor de después.
  if (draft && engine === undefined) setDraft(undefined);

  const local =
    draft !== undefined &&
    engine !== undefined &&
    (draft.dragging || draft.applied === undefined || draft.applied.over === engine);
  const intensity = local ? draft.value : engine;

  /** El DJ mueve el fader: se ve al momento y sale hacia el motor. */
  const change = (value: number) => {
    if (engine === undefined) return;
    const next = rounded(value);
    setDraft({ value: next, dragging: true });
    requests.send(INTENSITY_KEY, next);
  };

  /** El DJ suelta el fader. */
  const release = () => {
    setDraft((current) => {
      if (!current) return current;
      // Sin envíos en camino ni el último aplicado, el motor no la aplicó.
      if (!requests.busy(INTENSITY_KEY) && current.applied === undefined) return undefined;
      return { ...current, dragging: false };
    });
  };

  return { intensity, change, release };
}
