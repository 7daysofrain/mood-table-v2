import { Box, Group, Text } from '@mantine/core';

import type { ConnectionStatus } from '../engine/connection.ts';

/**
 * Indicador de conexión de la cabecera (specs/viewer, decisión 14): solo dos estados. «Reconectando»
 * sería lo mismo que «Sin conexión», porque el panel siempre está reintentando.
 */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const connected = status === 'connected';

  return (
    <Group gap="xs" role="status" aria-live="polite">
      <Box
        aria-hidden
        w={10}
        h={10}
        bd="2px solid var(--mantine-color-gray-5)"
        bg={connected ? 'green.6' : 'transparent'}
        style={{ borderRadius: '50%' }}
      />
      <Text size="sm">{connected ? 'Conectado' : 'Sin conexión con el motor'}</Text>
    </Group>
  );
}
