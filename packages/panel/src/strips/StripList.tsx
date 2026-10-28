import { Group, Radio, Stack, Text, VisuallyHidden } from '@mantine/core';
import type { StripState } from '@moodtable/shared';

import { ledCountLabel, OUTPUT_NAMES, STRIP_LIST_LABEL } from '../literals.ts';

interface StripListProps {
  /** Las tiras del motor, en el orden del fichero. */
  strips: readonly StripState[];
  /** El `id` de la tira seleccionada. */
  selectedId: string;
  onSelect: (stripId: string) => void;
}

/**
 * Zona Tiras (README §1.3, specs/instrument-control): las tiras declaradas, en solo lectura, con su
 * nombre, su nº de LEDs y su salida. Es un grupo de radios: se selecciona una sola, también con las
 * flechas del teclado, y el resto del panel actúa sobre ella.
 */
export function StripList({ strips, selectedId, onSelect }: Readonly<StripListProps>) {
  return (
    // Mantine nombra el grupo de radios con su `label`; a la vista ya está el título de la zona. En
    // bloque, la etiqueta oculta no deja una línea vacía encima de las tiras.
    <Radio.Group
      value={selectedId}
      onChange={onSelect}
      label={<VisuallyHidden>{STRIP_LIST_LABEL}</VisuallyHidden>}
      labelProps={{ display: 'block' }}
    >
      <Stack gap="xs">
        {strips.map((strip) => (
          <Radio.Card key={strip.id} value={strip.id} radius="md" p="sm">
            <Group wrap="nowrap" align="flex-start">
              <Radio.Indicator />
              <div>
                <Text fw={500}>{strip.name}</Text>
                <Text size="sm" c="dimmed">
                  {`${ledCountLabel(strip.ledCount)} · ${OUTPUT_NAMES[strip.output.type]}`}
                </Text>
              </div>
            </Group>
          </Radio.Card>
        ))}
      </Stack>
    </Radio.Group>
  );
}
