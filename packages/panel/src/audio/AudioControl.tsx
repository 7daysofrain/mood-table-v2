/**
 * Control de oír el fichero de audio (decisión 7 del change panel-audio-playback): un botón en la
 * cabecera, junto a la fuente, con tres estados. Callado, pide oír; mientras prepara el audio, avisa
 * y no hace nada; sonando, lo calla. Quién lo muestra decide cuándo hay algo que oír: solo con un
 * fichero como fuente.
 */
import { ActionIcon } from '@mantine/core';
import { type ReactElement, useCallback, useSyncExternalStore } from 'react';

import type { AudioPlayer } from './player.ts';

/** Lo que el control usa del reproductor: así los tests pueden darle uno falso. */
export type ControlPlayer = Pick<AudioPlayer, 'state' | 'subscribe' | 'play' | 'stop'>;

/** Iconos de *play* y *pause*: dos trazos, sin una librería de iconos para solo dos. */
function PlayIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export function AudioControl({ player }: Readonly<{ player: ControlPlayer }>): ReactElement {
  const subscribe = useCallback((listener: () => void) => player.subscribe(listener), [player]);
  const state = useSyncExternalStore(subscribe, () => player.state);

  if (state === 'preparing') {
    return (
      <ActionIcon variant="light" size="lg" aria-label="Preparando el audio" loading disabled />
    );
  }
  if (state === 'playing') {
    return (
      <ActionIcon
        variant="filled"
        size="lg"
        aria-label="Dejar de oír el fichero de audio"
        onClick={() => {
          player.stop();
        }}
      >
        <PauseIcon />
      </ActionIcon>
    );
  }
  return (
    <ActionIcon
      variant="light"
      size="lg"
      aria-label="Oír el fichero de audio"
      onClick={() => {
        player.play();
      }}
    >
      <PlayIcon />
    </ActionIcon>
  );
}
