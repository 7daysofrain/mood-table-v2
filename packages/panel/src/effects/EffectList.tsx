import { Badge, Button, Stack, Text } from '@mantine/core';
import { EFFECT_CATALOG, type EffectId, needsAudioSource } from '@moodtable/shared';
import { type MouseEvent, useId } from 'react';

import { EFFECT_KIND, EFFECT_LIST_LABEL, EFFECT_NAMES, NEEDS_AUDIO_SOURCE } from '../literals.ts';

interface EffectListProps {
  /** El efecto que el motor pinta en la tira seleccionada. */
  active: EffectId;
  /** Sin fuente de audio, los efectos reactivos no se pueden elegir. */
  hasAudioSource: boolean;
  onChoose: (effect: EffectId) => void;
}

/**
 * Zona Efectos (README §1.3, specs/instrument-control): los efectos del catálogo para la tira
 * seleccionada, etiquetados como reactivos o de ambiente, con el activo marcado. Se tocan como los
 * pads de una controladora (decisión 7 del change strip-effect-switch): el efecto se elige al pulsar,
 * no al soltar, y sin indicadores de espera; el activo es el que dice el motor, no el pulsado.
 */
export function EffectList({ active, hasAudioSource, onChoose }: Readonly<EffectListProps>) {
  return (
    <Stack gap="xs" role="group" aria-label={EFFECT_LIST_LABEL}>
      {EFFECT_CATALOG.map(({ id, usesAudio }) => (
        <EffectButton
          key={id}
          effect={id}
          reactive={usesAudio}
          active={id === active}
          disabled={!hasAudioSource && needsAudioSource(id)}
          onChoose={onChoose}
        />
      ))}
    </Stack>
  );
}

interface EffectButtonProps {
  effect: EffectId;
  reactive: boolean;
  active: boolean;
  disabled: boolean;
  onChoose: (effect: EffectId) => void;
}

function EffectButton({ effect, reactive, active, disabled, onChoose }: Readonly<EffectButtonProps>) {
  const reasonId = useId();
  const choose = () => {
    if (!disabled) onChoose(effect);
  };
  // El ratón y el dedo eligen en `pointerdown`; su clic, que llega al soltar, ya no cuenta. Enter y
  // Espacio solo generan el clic, sin puntero (`detail` 0): ese sí elige.
  const chooseFromKeyboard = (event: MouseEvent) => {
    if (event.detail === 0) choose();
  };

  return (
    <div>
      <Button
        fullWidth
        justify="space-between"
        variant={active ? 'filled' : 'default'}
        aria-current={active ? 'true' : undefined}
        aria-describedby={disabled ? reasonId : undefined}
        disabled={disabled}
        onPointerDown={choose}
        onClick={chooseFromKeyboard}
        rightSection={
          <Badge variant="light" color={reactive ? 'orange' : 'teal'}>
            {reactive ? EFFECT_KIND.reactive : EFFECT_KIND.ambient}
          </Badge>
        }
      >
        {EFFECT_NAMES[effect]}
      </Button>
      {disabled && (
        <Text id={reasonId} size="xs" c="dimmed" mt={4}>
          {NEEDS_AUDIO_SOURCE}
        </Text>
      )}
    </div>
  );
}
