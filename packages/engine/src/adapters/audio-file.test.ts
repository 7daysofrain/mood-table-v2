import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadAudioFile } from './audio-file.ts';

const GOLPES = fileURLToPath(new URL('../../test/fixtures/golpes.wav', import.meta.url));

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moodtable-audio-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('la fuente de audio fichero', () => {
  it('lee y decodifica el fichero al arrancar, y suena en bucle', async () => {
    const result = await loadAudioFile(GOLPES);
    if (!result.ok) throw new Error(result.error);
    const window = new Float32Array(2205);

    expect(result.source.sampleRate).toBe(44_100);
    result.source.read(0.5, window);
    expect(Math.max(...window.map(Math.abs))).toBe(0);
    result.source.read(1.05, window);
    expect(Math.max(...window.map(Math.abs))).toBeGreaterThan(0.5);
    // A los 5,05 s, el fichero de 4 s ya ha vuelto a empezar: es el golpe del segundo 1.
    const again = new Float32Array(2205);
    result.source.read(5.05, again);
    expect(again).toEqual(window);
  });

  it('devuelve también los bytes que leyó, tal cual: los que sirve /audio', async () => {
    const result = await loadAudioFile(GOLPES);
    if (!result.ok) throw new Error(result.error);

    expect(result.bytes).toEqual(new Uint8Array(await readFile(GOLPES)));
  });

  it('con el fichero de golpes (4 s), a los 5 s va por el segundo 1', async () => {
    const result = await loadAudioFile(GOLPES);
    if (!result.ok) throw new Error(result.error);

    expect(result.source.positionAt?.(5)).toBeCloseTo(1, 3);
  });

  it('si el fichero no existe, lo dice con la ruta', async () => {
    const path = join(dir, 'no-existe.wav');

    expect(await loadAudioFile(path)).toEqual({
      ok: false,
      error: `${path}: no se encuentra el fichero de audio`,
    });
  });

  it('si no se puede leer, lo dice con la ruta', async () => {
    const path = join(dir, 'carpeta.wav');
    await mkdir(path);

    const result = await loadAudioFile(path);

    expect(!result.ok && result.error).toMatch(
      `${path}: no se puede leer el fichero de audio (`,
    );
  });

  it('si su formato no vale, nombra el fichero y dice qué formato acepta', async () => {
    const path = join(dir, 'musica.mp3');
    await writeFile(path, 'ID3 esto no es un WAV');

    expect(await loadAudioFile(path)).toEqual({
      ok: false,
      error: `${path}: formato no válido: se acepta WAV PCM de 16 bits, mono o estéreo`,
    });
  });
});
