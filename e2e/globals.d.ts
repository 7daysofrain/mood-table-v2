/**
 * Lo que el panel deja leer en `window` para que los E2E comprueben la sincronía sin oír (decisión 8
 * del change panel-audio-playback). Se declara aquí, sin importar código del panel: los E2E prueban
 * el sistema desde fuera (README §2.3).
 */
interface MoodTableAudio {
  state: 'silent' | 'preparing' | 'playing';
  /** El punto que suena menos el del visor, en segundos. Callado, `undefined`. */
  error: number | undefined;
}

interface Window {
  readonly moodTableAudio?: MoodTableAudio;
}
