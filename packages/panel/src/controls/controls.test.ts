import { EFFECT_CATALOG } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { PARAM_NAMES } from '../literals.ts';
import { controlsOf, positionOf, type SliderControl, valueAt } from './controls.ts';

/** El control del parámetro `param` de la respiración. */
function breathingControl(param: string) {
  const control = controlsOf('breathing').find((each) => each.param === param);
  if (!control) throw new Error(`La respiración no tiene control para «${param}»`);
  return control;
}

function periodSlider(): SliderControl {
  const control = breathingControl('period');
  if (control.kind !== 'slider') throw new Error('El periodo no es un slider');
  return control;
}

describe('los controles de cada efecto, a partir de su esquema', () => {
  it('el color de la respiración es un selector de color', () => {
    expect(breathingControl('color')).toEqual({ param: 'color', name: 'Color', kind: 'color' });
  });

  it('el periodo es un slider de 1 a 20 s en escala logarítmica', () => {
    expect(periodSlider()).toEqual({
      param: 'period',
      name: 'Periodo (s)',
      kind: 'slider',
      min: 1,
      max: 20,
      scale: 'log',
    });
  });

  it('la respiración tiene sus controles en el orden del esquema', () => {
    expect(controlsOf('breathing').map(({ param }) => param)).toEqual(['color', 'period']);
  });

  it('la energía, sin parámetros, no tiene controles', () => {
    expect(controlsOf('energy')).toEqual([]);
  });

  it.each(
    EFFECT_CATALOG.flatMap(({ id, paramsSchema }) =>
      Object.keys(paramsSchema.properties).map((param) => [id, param] as const),
    ),
  )('%s · %s tiene control y nombre', (effect, param) => {
    const control = controlsOf(effect).find((each) => each.param === param);

    expect(control?.kind).toBeDefined();
    expect(control?.name).toBe((PARAM_NAMES[effect] as Record<string, string>)[param]);
  });
});

describe('el recorrido del slider del periodo', () => {
  it('va de 1 s al principio a 20 s al final', () => {
    const slider = periodSlider();

    expect(valueAt(slider, 0)).toBeCloseTo(1);
    expect(valueAt(slider, 1)).toBeCloseTo(20);
  });

  it('en la mitad del recorrido marca unos 4,5 s', () => {
    expect(valueAt(periodSlider(), 0.5)).toBeCloseTo(4.47, 2);
  });

  it('el mismo tramo multiplica el periodo por lo mismo en cualquier punto', () => {
    const slider = periodSlider();

    expect(valueAt(slider, 0.3) / valueAt(slider, 0.1)).toBeCloseTo(
      valueAt(slider, 0.9) / valueAt(slider, 0.7),
    );
  });

  it('la posición de un valor es la inversa de su valor', () => {
    const slider = periodSlider();

    for (const seconds of [1, 2, 4, 7.5, 20]) {
      expect(valueAt(slider, positionOf(slider, seconds))).toBeCloseTo(seconds);
    }
  });
});
