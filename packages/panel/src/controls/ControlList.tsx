import { ColorPicker, Group, Slider, Stack, Text } from '@mantine/core';
import type { StripState } from '@moodtable/shared';
import { useId } from 'react';

import { CONTROL_LABELS, formatValue } from '../literals.ts';
import {
  type ColorControl,
  controlsOf,
  positionOf,
  type SliderControl,
  valueAt,
} from './controls.ts';
import { useDraftValues, type ValueRequests } from './use-draft-values.ts';

interface ControlListProps {
  /** La tira seleccionada, con su efecto activo y los valores con que la pinta el motor. */
  strip: StripState;
  requests: ValueRequests;
}

/**
 * Zona Controles (README §1.3, specs/instrument-control): un control por cada parámetro del efecto
 * activo, generado de su esquema (decisión 5 del change strip-effect-values). Cada movimiento sale
 * hacia el motor mientras se arrastra, sin esperar a soltar (E1). Un efecto sin parámetros no pinta
 * nada, y la zona queda con su título.
 */
export function ControlList({ strip, requests }: Readonly<ControlListProps>) {
  const { values, change, release } = useDraftValues(strip, requests);
  const controls = controlsOf(strip.effect);
  if (controls.length === 0 || !values) return null;

  return (
    <Stack gap="lg">
      {controls.map((control) =>
        control.kind === 'color' ? (
          <ColorField
            key={control.param}
            control={control}
            value={String(values[control.param])}
            onChange={(color) => {
              change(control.param, color);
            }}
            onRelease={release}
          />
        ) : (
          <SliderField
            key={control.param}
            control={control}
            value={Number(values[control.param])}
            onChange={(value) => {
              change(control.param, value);
            }}
            onRelease={release}
          />
        ),
      )}
    </Stack>
  );
}

interface FieldProps<C, V> {
  control: C;
  value: V;
  onChange: (value: V) => void;
  onRelease: () => void;
}

/** El nombre del parámetro y su valor, encima del control. */
function FieldHeader({ id, name, value }: Readonly<{ id: string; name: string; value: string }>) {
  return (
    <Group justify="space-between" mb={6}>
      <Text id={id} size="sm" fw={500}>
        {name}
      </Text>
      <Text size="sm" c="dimmed" ff="monospace">
        {value}
      </Text>
    </Group>
  );
}

/**
 * Un color, con el selector en línea y sin desplegable: se toca directamente, como un pad (riesgos
 * de `design.md`).
 */
function ColorField({ control, value, onChange, onRelease }: Readonly<FieldProps<ColorControl, string>>) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <FieldHeader id={id} name={control.name} value={value.toUpperCase()} />
      <ColorPicker
        format="hex"
        fullWidth
        value={value}
        onChange={onChange}
        onChangeEnd={onRelease}
        saturationLabel={CONTROL_LABELS.saturation}
        hueLabel={CONTROL_LABELS.hue}
      />
    </div>
  );
}

/**
 * Un número con rango. El slider trabaja en el recorrido (de 0 a 1) y `scale` lo pasa al valor, así
 * que la escala logarítmica solo vive aquí: lo que sale hacia el motor es siempre el valor.
 */
function SliderField({ control, value, onChange, onRelease }: Readonly<FieldProps<SliderControl, number>>) {
  const id = useId();
  const toValue = (position: number) => Math.round(valueAt(control, position) * 100) / 100;
  return (
    <div>
      <FieldHeader id={id} name={control.name} value={formatValue(value)} />
      <Slider
        min={0}
        max={1}
        step={0.001}
        value={positionOf(control, value)}
        scale={toValue}
        label={formatValue}
        thumbLabel={control.name}
        thumbValueText={formatValue}
        onChange={(position) => {
          onChange(toValue(position));
        }}
        onChangeEnd={onRelease}
      />
    </div>
  );
}
