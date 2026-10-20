/**
 * Lo que el panel deja leer en `window` para que los E2E comprueben la sincronía sin oír (decisión 8
 * del change panel-audio-playback). Se declara aquí, sin importar código del panel: los E2E prueban
 * el sistema desde fuera (README §2.3).
 */
interface MoodTableAudio {
  state: 'silent' | 'preparing' | 'playing';
  /**
   * El último error medido antes de corregir: el punto que suena menos el del visor, en segundos.
   * Callado, o antes de la primera comprobación, `undefined`.
   */
  error: number | undefined;
  /** Cuántas veces ha saltado para corregir la deriva desde que el maker pidió oír. */
  jumps: number;
}

interface Window {
  readonly moodTableAudio?: MoodTableAudio;
}
