import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAudioFile } from './audio-file.ts';
import { CONFIG_FILE, loadConfig, REPO_ROOT } from './config-file.ts';

const run = promisify(execFile);

const demoStrip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' },
  ledCount: 60,
  effect: 'breathing',
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'moodtable-config-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<void> {
  await mkdir(join(root, 'config'));
  await writeFile(join(root, CONFIG_FILE), content);
}

// Con '' como ruta alternativa, los tests ignoran un MOODTABLE_CONFIG que pudiera haber en el entorno.
describe('la lectura de config/local.json', () => {
  it('carga un fichero válido y dice de dónde lo ha cargado', async () => {
    await writeConfig(JSON.stringify({ strips: [demoStrip] }));

    const result = await loadConfig(root, '');

    expect(result).toEqual({
      ok: true,
      path: join(root, 'config', 'local.json'),
      file: 'config/local.json',
      config: { fps: 60, server: { host: '127.0.0.1', port: 8080 }, strips: [demoStrip] },
    });
  });

  it('si no existe, dice que no encuentra el fichero e indica su ruta', async () => {
    const result = await loadConfig(root, '');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe(
      `${join(root, 'config', 'local.json')}: no se encuentra el fichero de configuración`,
    );
  });

  it('si no se puede leer, lo dice con la ruta', async () => {
    await mkdir(join(root, CONFIG_FILE), { recursive: true });

    const result = await loadConfig(root, '');

    expect(!result.ok && result.error).toMatch(/local\.json: no se puede leer el fichero/);
  });

  it('si no sirve, nombra el fichero y dice qué falla', async () => {
    await writeConfig(JSON.stringify({ strips: [] }));

    const result = await loadConfig(root, '');

    expect(!result.ok && result.error).toMatch(
      `${join(root, 'config', 'local.json')}: no declara ninguna tira`,
    );
  });

  it('con MOODTABLE_CONFIG, carga ese fichero en lugar de config/local.json y lo nombra así', async () => {
    await writeConfig(JSON.stringify({ strips: [demoStrip] }));
    const e2e = join(root, 'e2e.json');
    await writeFile(e2e, JSON.stringify({ fps: 30, strips: [demoStrip] }));

    const result = await loadConfig(root, e2e);

    expect(result.ok && [result.path, result.file, result.config.fps]).toEqual([e2e, e2e, 30]);
  });

  it('con MOODTABLE_CONFIG a un fichero que no existe, lo dice con su ruta', async () => {
    const result = await loadConfig(root, join(root, 'no-existe.json'));

    expect(!result.ok && result.error).toBe(
      `${join(root, 'no-existe.json')}: no se encuentra el fichero de configuración`,
    );
  });

  it('si no se le pasa la ruta, la toma de la variable de entorno MOODTABLE_CONFIG', async () => {
    await writeFile(join(root, 'desde-env.json'), JSON.stringify({ strips: [demoStrip] }));
    vi.stubEnv('MOODTABLE_CONFIG', join(root, 'desde-env.json'));

    const result = await loadConfig(root);
    vi.unstubAllEnvs();

    expect(result.ok && result.path).toBe(join(root, 'desde-env.json'));
  });

  it('con MOODTABLE_CONFIG relativa, la resuelve desde la raíz y no desde el directorio de trabajo', async () => {
    // El directorio de trabajo de los tests es el del repositorio, no `root`.
    await mkdir(join(root, 'e2e'));
    await writeFile(join(root, 'e2e', 'config.json'), JSON.stringify({ strips: [demoStrip] }));

    const result = await loadConfig(root, 'e2e/config.json');

    expect(result.ok && [result.path, result.file]).toEqual([
      join(root, 'e2e', 'config.json'),
      'e2e/config.json',
    ]);
  });

  it('busca el fichero desde la raíz del repositorio, sea cual sea el directorio de trabajo', async () => {
    // Un proceso de Node arrancado en otro directorio, como el motor arrancado desde otro sitio.
    const module = fileURLToPath(new URL('./config-file.ts', import.meta.url));
    const script = `const m = await import(${JSON.stringify(module)}); console.log(m.REPO_ROOT);`;
    const { stdout } = await run(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
    });

    expect(stdout.trim()).toBe(fileURLToPath(new URL('../../../../', import.meta.url)));
    expect(REPO_ROOT).toBe(stdout.trim());
  });
});

describe('la ruta del fichero de audio', () => {
  it('relativa, la resuelve desde la raíz del repositorio y la deja absoluta', async () => {
    const audioSource = { type: 'file', path: 'config/audio/bouncer.wav' };
    await writeConfig(JSON.stringify({ audioSource, strips: [demoStrip] }));

    const result = await loadConfig(root, '');

    expect(result.ok && result.config.audioSource).toEqual({
      type: 'file',
      path: join(root, 'config', 'audio', 'bouncer.wav'),
    });
  });

  it('absoluta, la respeta', async () => {
    const path = join(tmpdir(), 'otra-carpeta', 'musica.wav');
    await writeConfig(JSON.stringify({ audioSource: { type: 'file', path }, strips: [demoStrip] }));

    const result = await loadConfig(root, '');

    expect(result.ok && result.config.audioSource).toEqual({ type: 'file', path });
  });

  it('sin fuente de audio, la configuración no tiene ninguna', async () => {
    await writeConfig(JSON.stringify({ strips: [demoStrip] }));

    const result = await loadConfig(root, '');

    expect(result.ok && 'audioSource' in result.config).toBe(false);
  });
});

describe('el config/demo.json del repositorio', () => {
  // specs/engine-config, «El simulador arranca sin preparar nada»: lo que `pnpm dev` copia a
  // `config/local.json` en un clon limpio.
  it('arranca con una tira virtual con energía y el fichero de audio de la demo', async () => {
    const result = await loadConfig(REPO_ROOT, 'config/demo.json');
    if (!result.ok) throw new Error(result.error);
    const { strips, audioSource } = result.config;

    expect(strips.map(({ output, effect }) => [output.type, effect])).toEqual([['virtual', 'energy']]);
    expect(audioSource).toEqual({
      type: 'file',
      path: join(REPO_ROOT, 'config', 'audio', 'bouncer.wav'),
    });
  });

  it('su fichero de audio está en el repositorio y el motor lo acepta', async () => {
    const audio = await loadAudioFile(join(REPO_ROOT, 'config', 'audio', 'bouncer.wav'));

    expect(audio.ok && audio.source.sampleRate).toBe(44_100);
  });
});
