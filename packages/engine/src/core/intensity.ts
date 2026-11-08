/**
 * La intensidad del instrumento (specs/intensity; decisiones 1 a 3 del change
 * instrument-intensity): un máster de brillo para todas las tiras. Es un paso fijo del plano de
 * tiempo real, entre el efecto y las salidas, y ningún efecto la conoce.
 */

/**
 * Multiplica cada canal de `frame` (RGB, 3 bytes por LED) por `intensity`, de 0 a 1, y lo redondea
 * al entero más cercano, como la *respiración*: truncar apagaría antes los valores bajos.
 *
 * Escala el frame en su sitio y no crea nada, porque se llama en cada pulso. Es seguro porque un
 * efecto escribe todo su frame en cada `render` sin leer lo que había (contrato de `Effect`). A 1
 * sale sin tocarlo: el máximo es el efecto tal cual y no cuesta nada mientras nadie toca el fader.
 */
export function applyIntensity(frame: Uint8Array, intensity: number): void {
  if (intensity === 1) return;
  for (let index = 0; index < frame.length; index++) {
    frame[index] = Math.round((frame[index] ?? 0) * intensity);
  }
}
