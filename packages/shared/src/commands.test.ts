import Value from 'typebox/value';
import { describe, expect, it } from 'vitest';

import {
  ApiErrorSchema,
  SetEffectBodySchema,
  SetEffectResponseSchema,
  SetValuesBodySchema,
  SetValuesResponseSchema,
} from './commands.ts';

describe('el cuerpo del cambio de efecto', () => {
  it('acepta el ejemplo: el id de un efecto del catálogo', () => {
    expect(Value.Check(SetEffectBodySchema, { effect: 'breathing' })).toBe(true);
  });

  it.each([
    ['un efecto que no existe', { effect: 'strobe' }],
    ['un cuerpo con campos de más', { effect: 'breathing', speed: 2 }],
    ['un cuerpo sin efecto', {}],
  ])('rechaza %s', (_name, body) => {
    expect(Value.Check(SetEffectBodySchema, body)).toBe(false);
  });
});

describe('la respuesta del cambio de efecto', () => {
  it('acepta la tira con su efecto activo y sus valores, como en el mensaje de las tiras', () => {
    const strip = {
      id: 'demo',
      name: 'Tira de prueba',
      ledCount: 60,
      output: { type: 'virtual' },
      effect: 'breathing',
      values: { color: '#FFA957', period: 4 },
    };

    expect(Value.Check(SetEffectResponseSchema, strip)).toBe(true);
  });
});

describe('el cuerpo del cambio de valores', () => {
  it('acepta el ejemplo: los valores de la respiración', () => {
    expect(Value.Check(SetValuesBodySchema, { color: '#2040FF', period: 7 })).toBe(true);
  });

  it('acepta los de la energía, que no tiene parámetros', () => {
    expect(Value.Check(SetValuesBodySchema, {})).toBe(true);
  });

  it.each([
    ['un periodo fuera de rango', { color: '#2040FF', period: 25 }],
    ['un campo de más', { color: '#2040FF', period: 7, speed: 2 }],
    ['un color que no es #RRGGBB', { color: 'azul', period: 7 }],
  ])('rechaza %s', (_name, body) => {
    expect(Value.Check(SetValuesBodySchema, body)).toBe(false);
  });
});

describe('la respuesta del cambio de valores', () => {
  it('acepta la tira con sus valores nuevos', () => {
    const strip = {
      id: 'demo',
      name: 'Tira de prueba',
      ledCount: 60,
      output: { type: 'virtual' },
      effect: 'breathing',
      values: { color: '#2040FF', period: 7 },
    };

    expect(Value.Check(SetValuesResponseSchema, strip)).toBe(true);
  });
});

describe('el error de la API', () => {
  it('acepta un mensaje', () => {
    expect(Value.Check(ApiErrorSchema, { message: 'la tira «luces» no existe' })).toBe(true);
  });

  it.each([
    ['sin mensaje', {}],
    ['con un mensaje vacío', { message: '' }],
    ['con campos de más', { message: 'no existe', code: 404 }],
  ])('rechaza uno %s', (_name, error) => {
    expect(Value.Check(ApiErrorSchema, error)).toBe(false);
  });
});
