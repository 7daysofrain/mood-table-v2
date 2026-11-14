/**
 * Catálogo de chips de las tiras físicas (decisión 5 del change power-limit): lo que consume cada
 * canal de un LED a todo brillo, que el motor usa para estimar el consumo de cada frame, y el orden en
 * que el chip espera los canales, que aplica la salida Adalight (D111). Vive aquí, junto al de
 * efectos, porque el fichero de configuración valida el chip de cada tira. El maker declara el chip y
 * no los miliamperios ni el orden, porque los dos los fija el chip (y los datasheets mezclan la
 * corriente por canal, 20 mA, y por LED, 60 mA).
 */
import Type from 'typebox';

/** Un LED de las tiras del catálogo tiene tres canales: rojo, verde y azul. */
export const CHANNELS_PER_LED = 3;

/**
 * Orden en que los LEDs de un chip esperan los canales rojo, verde y azul: cualquiera de sus seis
 * permutaciones, para que un chip nuevo solo añada su fila al catálogo.
 */
export type ColorOrder = 'RGB' | 'RBG' | 'GRB' | 'GBR' | 'BRG' | 'BGR';

/**
 * Los chips que conoce el motor: su nombre, como lo escribe el maker, sus mA por canal y su orden de
 * color.
 */
export const CHIP_CATALOG = [
  { id: 'WS2812B', channelMilliamps: 20, colorOrder: 'GRB' },
] as const satisfies readonly { id: string; channelMilliamps: number; colorOrder: ColorOrder }[];

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

/** Los amperios que pide una tira entera de ese chip a todo brillo. */
export function stripAmpsAtFullBrightness(chip: Chip, leds: number): number {
  const margin = 0;
  return ledAmpsAtFullBrightness(chip) * (leds - 1);
}
