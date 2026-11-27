import { describe, expect, it } from 'vitest';

import { loadFixerConfig } from './config.ts';

const minimal = {
  ANTHROPIC_API_KEY: 'sk-ant',
  FIXER_APP_CLIENT_ID: 'Iv23',
  FIXER_APP_PRIVATE_KEY_FILE: '/run/secrets/app-private-key.pem',
  FIXER_REPOSITORY: '7daysofrain/mood-table-v2',
};

describe('la configuración del fixer', () => {
  it('con lo mínimo, el resto tiene su valor por defecto: Sonnet, el puerto 8080 y la App como autor', () => {
    const config = loadFixerConfig(minimal);

    expect(config).toMatchObject({
      anthropicApiKey: 'sk-ant',
      repository: '7daysofrain/mood-table-v2',
      port: 8080,
      dbPath: '/data/fixer.sqlite',
      model: 'claude-sonnet-5-5',
      maxTurns: 40,
      commandTimeoutMs: 15 * 60_000,
      author: {
        name: 'mood-table-pr-babysitter[bot]',
        email: '361920848+mood-table-pr-babysitter[bot]@users.noreply.github.com',
      },
    });
  });

  it('una variable vacía vale su valor por defecto', () => {
    expect(loadFixerConfig({ ...minimal, FIXER_MODEL: '', FIXER_MAX_TURNS: '' })).toMatchObject({
      model: 'claude-sonnet-5-5',
      maxTurns: 40,
    });
  });

  it('si falta algo o no vale, no arranca y dice qué variable', () => {
    expect(() => loadFixerConfig({ ...minimal, ANTHROPIC_API_KEY: '', FIXER_REPOSITORY: 'mood-table-v2' })).toThrow(
      /ANTHROPIC_API_KEY: falta[\s\S]*FIXER_REPOSITORY: no es owner\/name/,
    );
  });
});
