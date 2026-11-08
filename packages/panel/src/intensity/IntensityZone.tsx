import { Slider, Stack, Text } from '@mantine/core';

import { INTENSITY_LABEL, formatPercent } from '../literals.ts';
import { type IntensityRequests, useDraftIntensity } from './use-draft-intensity.ts';

interface IntensityZoneProps {
  /** La intensidad con que pinta el motor, de 0 a 1 (mensaje `7`). */
  intensity: number;
  /** La cola de los cambios de intensidad. */
  requests: IntensityRequests;
}

/**
 * El contenido de la zona «Intensidad» (specs/intensity; decisiones 6 y 7 del change
 * instrument-intensity): un fader vertical, con el máximo arriba y el cero abajo, que ocupa la
 * altura que queda bajo el porcentaje, como el máster de una mesa de mezclas. Es lineal, con paso
 * 0,01, y muestra la intensidad en porcentaje entero. No depende de la tira seleccionada.
 */
export function IntensityZone({ intensity: engine, requests }: Readonly<IntensityZoneProps>) {
  const { intensity, change, release } = useDraftIntensity(engine, requests);
  if (intensity === undefined) return null;
  return (
    <Stack align="center" gap="md" flex={1} mih={0}>
      <Text size="lg" fw={600} ff="monospace" style={{ whiteSpace: 'nowrap' }}>
        {formatPercent(intensity)}
      </Text>
      <Slider
        orientation="vertical"
        h="100%"
        flex={1}
        min={0}
        max={1}
        step={0.01}
        value={intensity}
        label={formatPercent}
        thumbLabel={INTENSITY_LABEL}
        thumbValueText={formatPercent}
        onChange={change}
        onChangeEnd={release}
      />
    </Stack>
  );
}
