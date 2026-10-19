/**
 * Control de oír el fichero de audio (decisión 7 del change panel-audio-playback).
 */
import type { ReactElement } from 'react';

import type { AudioPlayer } from './player.ts';

/** Lo que el control usa del reproductor: así los tests pueden darle uno falso. */
export type ControlPlayer = Pick<AudioPlayer, 'state' | 'subscribe' | 'play' | 'stop'>;

export function AudioControl({ player }: Readonly<{ player: ControlPlayer }>): ReactElement {
  void player;
  throw new Error('Sin implementar');
}
