import Value from 'typebox/value';
import { describe, expect, it } from 'vitest';

import {
  BreathingParamsSchema,
  EFFECT_CATALOG,
  EnergyParamsSchema,
  needsAudioSource,
} from './effects.ts';

describe('qué efectos necesitan una fuente de audio', () => {
  it('la respiración, que es de ambiente, no la necesita', () => {
    expect(needsAudioSource('breathing')).toBe(false);
  });

  it('energía, que es reactivo, la necesita', () => {
    expect(needsAudioSource('energy')).toBe(true);
  });

  it.each(EFFECT_CATALOG.map((effect) => [effect.id, effect.usesAudio] as const))(
    '%s: lo dice usesAudio del catálogo (%s)',
    (id, usesAudio) => {
      expect(needsAudioSource(id)).toBe(usesAudio);
    },
  );
});

describe('los parámetros de la respiración', () => {
  const breathing = (period: number) => ({ color: '#FFA957', period });

  it.each([1, 4, 20])('acepta un periodo de %s s', (period) => {
    expect(Value.Check(BreathingParamsSchema, breathing(period))).toBe(true);
  });

  it.each([0.5, 25])('rechaza un periodo de %s s, fuera del rango de 1 a 20', (period) => {
    expect(Value.Check(BreathingParamsSchema, breathing(period))).toBe(false);
  });

  it('pide un selector de color para el color', () => {
    expect(BreathingParamsSchema.properties.color).toMatchObject({ 'x-control': 'color' });
  });

  it('pide una escala logarítmica para el periodo', () => {
    expect(BreathingParamsSchema.properties.period).toMatchObject({ 'x-scale': 'log' });
  });

  it('rechaza un campo que no declara', () => {
    expect(Value.Check(BreathingParamsSchema, { ...breathing(4), speed: 2 })).toBe(false);
  });
});

describe('los parámetros de la energía', () => {
  it('acepta un objeto vacío', () => {
    expect(Value.Check(EnergyParamsSchema, {})).toBe(true);
  });

  it('rechaza los valores de otro efecto', () => {
    expect(Value.Check(EnergyParamsSchema, { period: 7 })).toBe(false);
  });
});

describe('el catálogo de efectos', () => {
  it.each(EFFECT_CATALOG.map((effect) => [effect.id, effect] as const))(
    '%s trae su esquema de parámetros, cerrado',
    (_id, effect) => {
      expect(effect.paramsSchema).toMatchObject({ type: 'object', additionalProperties: false });
    },
  );

  it('los valores por defecto de cada efecto cumplen su esquema', () => {
    for (const { paramsSchema } of EFFECT_CATALOG) {
      expect(Value.Check(paramsSchema, Value.Create(paramsSchema))).toBe(true);
    }
  });
});
