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
  /** Contenido de la zona «Tiras». */
  strips?: ReactNode;
  /** Contenido de la zona «Efectos». */
  effects?: ReactNode;
  /** Contenido de la zona «Controles». */
  controls?: ReactNode;
  /** Contenido de la zona «Intensidad». */
  intensity?: ReactNode;
}

/**
 * Estructura del panel (README §1.3, specs/panel-layout): cabecera arriba, visor a todo el ancho y,
 * debajo, tiras, efectos y controles en tres columnas. A la derecha de todo y a toda la altura bajo
 * la cabecera, la intensidad, que es del instrumento y no de la tira seleccionada (decisión 6 del
 * change instrument-intensity); va después de `AppShell.Main`, así que es la última zona en el orden
 * de lectura. Cada historia pone su contenido en su zona; las que aún no rellena ninguna, quedan
 * vacías.
 */
export function PanelLayout({
  status,
  audio,
  viewer,
  strips,
  effects,
  controls,
  intensity,
}: Readonly<PanelLayoutProps>) {
  return (
    <AppShell header={{ height: 60 }} aside={{ width: 140, breakpoint: 0 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
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
            <Zone title="Tiras">{strips}</Zone>
            <Zone title="Efectos">{effects}</Zone>
            <Zone title="Controles">{controls}</Zone>
          </SimpleGrid>
        </Stack>
      </AppShell.Main>

      <AppShell.Aside p="md" pl={0} withBorder={false}>
        <Zone title="Intensidad" fill>
          {intensity}
        </Zone>
      </AppShell.Aside>
    </AppShell>
  );
}
