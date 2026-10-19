import { Box, Group, Text } from '@mantine/core';
import type { SourceMessage } from '@moodtable/shared';
import { useEffect, useRef } from 'react';

import { levelToDecibels, levelToFill, METER_MIN_DB } from './level.ts';

/** De dónde lee el vúmetro el último nivel de la fuente de audio. */
export interface LevelSource {
  readonly level: number | undefined;
}

/**
 * Fuente de audio de la cabecera (specs/audio-source, decisión 14 del change
 * virtual-strip-audio-file): «Fichero: nombre» con su vúmetro, o «Sin fuente de audio». Sin conexión
 * no se sabe cuál es, así que no muestra nada.
 */
export function AudioSourceIndicator({
  source,
  levels,
}: Readonly<{ source?: SourceMessage; levels: LevelSource }>) {
  if (!source) return null;
  if (source.kind === 'none') {
    return (
      <Text size="sm" c="dimmed">
        Sin fuente de audio
      </Text>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm">{`Fichero: ${source.name}`}</Text>
      <LevelMeter levels={levels} />
    </Group>
  );
}

/**
 * Vúmetro: una barra horizontal que pinta el último nivel recibido en cada `requestAnimationFrame`,
 * como el visor sus frames. Escribe en el DOM directamente, sin repintar React 60 veces por segundo,
 * y no guarda los niveles intermedios.
 */
function LevelMeter({ levels }: Readonly<{ levels: LevelSource }>) {
  const meterRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const meter = meterRef.current;
    const bar = barRef.current;
    if (!meter || !bar) return;

    let request = 0;
    const draw = () => {
      const level = levels.level ?? 0;
      meter.setAttribute('aria-valuenow', String(Math.round(levelToDecibels(level))));
      bar.style.width = `${(levelToFill(level) * 100).toFixed(1)}%`;
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(request);
    };
  }, [levels]);

  return (
    <Box
      ref={meterRef}
      role="meter"
      aria-label="Nivel de la fuente de audio"
      aria-valuemin={METER_MIN_DB}
      aria-valuemax={0}
      aria-valuenow={METER_MIN_DB}
      w={120}
      h={8}
      bg="var(--mantine-color-default-border)"
      style={{ borderRadius: 4, overflow: 'hidden' }}
    >
      <Box ref={barRef} h="100%" w="0%" bg="green.6" />
    </Box>
  );
}
