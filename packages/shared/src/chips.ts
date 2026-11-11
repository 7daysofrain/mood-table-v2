/**
 * Catálogo de chips de las tiras físicas (decisión 5 del change power-limit): lo que consume cada
 * canal de un LED a todo brillo, que el motor usa para estimar el consumo de cada frame. Vive aquí,
 * junto al de efectos, porque el fichero de configuración valida el chip de cada tira. El maker
 * declara el chip y no los miliamperios, porque los datasheets mezclan la corriente por canal (20 mA)
 * y por LED (60 mA).
 */
import Type from 'typebox';

/** Un LED de las tiras del catálogo tiene tres canales: rojo, verde y azul. */
export const CHANNELS_PER_LED = 3;

/** Los chips que conoce el motor: su nombre, como lo escribe el maker, y sus mA por canal. */
export const CHIP_CATALOG = [{ id: 'WS2812B', channelMilliamps: 20 }] as const;

export type ChipId = (typeof CHIP_CATALOG)[number]['id'];

export type Chip = (typeof CHIP_CATALOG)[number];

/**
 * El chip de una tira física, para el fichero de configuración. La unión se genera del catálogo, y
 * `Unsafe` le da su tipo, que el `map` pierde; el esquema es el mismo.
 */
export const ChipIdSchema = Type.Unsafe<ChipId>(
  Type.Union(CHIP_CATALOG.map((chip) => Type.Literal(chip.id))),
);

/** El chip del catálogo con ese nombre. */
export function chipOf(id: ChipId): Chip {
  const chip = CHIP_CATALOG.find((each) => each.id === id);
  if (!chip) throw new Error(`El chip ${id} no está en el catálogo`);
  return chip;
}

/** Los amperios que pide un LED de ese chip a todo brillo (los tres canales). */
export function ledAmpsAtFullBrightness(chip: Chip): number {
  return (CHANNELS_PER_LED * chip.channelMilliamps) / 1000;
}
