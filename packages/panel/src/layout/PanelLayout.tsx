import { AppShell, Group, SimpleGrid, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import type { ConnectionStatus } from '../engine/connection.ts';
import { ConnectionIndicator } from './ConnectionIndicator.tsx';

import { Zone } from './Zone.tsx';

interface PanelLayoutProps {
  /** Estado de la conexión con el motor, que muestra la cabecera. */
  status: ConnectionStatus;
  /** La fuente de audio y su vúmetro, a la izquierda del indicador de conexión. */
  audio?: ReactNode;
  /** Contenido de la zona «Visor». */
  viewer?: ReactNode;
}

/**
 * Estructura del panel (README §1.3, specs/panel-layout): cabecera arriba, visor a todo el ancho y,
 * debajo, tiras, efectos y controles en tres columnas. Cada historia pone su contenido en su zona; las
 * que aún no rellena ninguna, quedan vacías.
 */
export function PanelLayout({ status, audio, viewer }: Readonly<PanelLayoutProps>) {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={1} size="h3">
            Mood Table
          </Title>
          <Group gap="lg" wrap="nowrap">
            {audio}
            <ConnectionIndicator status={status} />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {/* Ocupa el alto de la ventana bajo la cabecera; las tres columnas se llevan lo que deja el visor. */}
        <Stack h="calc(100dvh - var(--app-shell-header-offset) - 2 * var(--app-shell-padding))">
          <Zone title="Visor" minHeight={200}>
            {viewer}
          </Zone>
          <SimpleGrid cols={3} flex={1}>
            <Zone title="Tiras" />
            <Zone title="Efectos" />
            <Zone title="Controles" />
          </SimpleGrid>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
