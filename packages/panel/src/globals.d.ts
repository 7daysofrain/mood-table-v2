import type { PlayerState } from './audio/player.ts';

declare global {
  interface Window {
    /**
     * El estado del reproductor, el último error de sincronía medido antes de corregir y los saltos
     * desde que se pidió oír, de solo lectura, para que los E2E comprueben la sincronía sin oír
     * (decisión 8 del change panel-audio-playback).
     */
    readonly moodTableAudio?: { state: PlayerState; error: number | undefined; jumps: number };
  }
}
