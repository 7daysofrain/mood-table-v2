import type { PlayerState } from './audio/player.ts';

declare global {
  interface Window {
    /**
     * El estado del reproductor y el error de sincronía estimado, de solo lectura, para que los E2E
     * comprueben la sincronía sin oír (decisión 8 del change panel-audio-playback).
     */
    readonly moodTableAudio?: { state: PlayerState; error: number | undefined };
  }
}
