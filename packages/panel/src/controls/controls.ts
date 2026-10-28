/**
 * Qué control pinta cada parámetro (decisión 5 del change strip-effect-values): se lee del esquema
 * del efecto, sin conocer el efecto, así que uno nuevo no obliga a tocar el panel (E9). Lo que JSON
 * Schema ya expresa va con sus palabras (`type`, `minimum`, `maximum`); lo que no, en las
 * extensiones `x-control` y `x-scale`.
 */
import { EFFECT_CATALOG, type EffectId } from '@moodtable/shared';

import { PARAM_NAMES } from '../literals.ts';

interface ControlBase {
  /** El nombre del parámetro en el esquema, que es también la clave de su valor. */
  param: string;
  /** Lo que lee el DJ. */
  name: string;
}

export interface ColorControl extends ControlBase {
  kind: 'color';
}

export interface SliderControl extends ControlBase {
  kind: 'slider';
  min: number;
  max: number;
  /** Logarítmica: el mismo tramo del recorrido multiplica el valor por el mismo factor. */
  scale: 'linear' | 'log';
}

export type ParamControl = ColorControl | SliderControl;

/** Lo que el panel lee del esquema de un parámetro. */
interface ParamSchema {
  type?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  'x-control'?: unknown;
  'x-scale'?: unknown;
}

function controlFor(param: string, name: string, schema: ParamSchema): ParamControl {
  if (schema['x-control'] === 'color') return { param, name, kind: 'color' };
  const { minimum: min, maximum: max } = schema;
  if (schema.type === 'number' && typeof min === 'number' && typeof max === 'number') {
    const scale = schema['x-scale'] === 'log' ? 'log' : 'linear';
    return { param, name, kind: 'slider', min, max, scale };
  }
  // Un test recorre el catálogo: un parámetro sin control es un fallo del panel, no del DJ.
  throw new Error(`El parámetro «${param}» no tiene ningún control que lo pinte`);
}

/** Los controles de los parámetros de `effect`, en el orden de su esquema. */
export function controlsOf(effect: EffectId): ParamControl[] {
  const entry = EFFECT_CATALOG.find((each) => each.id === effect);
  if (!entry) throw new Error(`El efecto «${effect}» no está en el catálogo`);
  const names: Record<string, string> = PARAM_NAMES[effect];
  return Object.entries(entry.paramsSchema.properties).map(([param, schema]) =>
    controlFor(param, names[param] ?? param, schema as ParamSchema),
  );
}

/** El valor del slider en `position`, de 0 (el principio del recorrido) a 1 (el final). */
export function valueAt({ min, max, scale }: SliderControl, position: number): number {
  return scale === 'log' ? min * (max / min) ** position : min + (max - min) * position;
}

/** La posición del recorrido, de 0 a 1, en la que el slider marca `value`. */
export function positionOf({ min, max, scale }: SliderControl, value: number): number {
  if (scale === 'log') return Math.log(value / min) / Math.log(max / min);
  return (value - min) / (max - min);
}
