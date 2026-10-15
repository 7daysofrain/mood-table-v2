/**
 * El temporizador del bucle (decisión 7): llama a `onTick(now)` `fps` veces por segundo, fuera del
 * núcleo. Cada vuelta se programa para el inicio del pulso siguiente, medido desde el arranque, así
 * que el retraso de una vuelta no se arrastra a las demás.
 */
export interface Ticker {
  stop(): void;
}

export function startTicker(
  fps: number,
  onTick: (now: number) => void,
  clock: () => number = () => performance.now(),
): Ticker {
  const period = 1000 / fps;
  const startedAt = clock();
  let pulse = 0;
  let timer: NodeJS.Timeout | undefined;

  const run = () => {
    const tickedAt = clock();
    onTick(tickedAt);
    const now = clock();
    pulse = Math.max(
      pulse + 1,
      // El bucle calcula el pulso más cercano al instante: si el temporizador llegó tarde, puede
      // haber calculado ya el siguiente, y volver a despertar para ese no serviría de nada.
      Math.round((tickedAt - startedAt) / period) + 1,
      // Si esta vuelta tardó, los pulsos que ya han pasado se saltan.
      Math.floor((now - startedAt) / period) + 1,
    );
    timer = setTimeout(run, startedAt + pulse * period - now);
  };
  run();

  return {
    stop() {
      clearTimeout(timer);
    },
  };
}
