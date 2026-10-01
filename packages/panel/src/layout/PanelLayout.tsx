import { AppShell, Group, SimpleGrid, Stack, Title } from '@mantine/core';

import { Zone } from './Zone.tsx';

/**
 * Estructura del panel (README §1.3, specs/panel-layout): cabecera arriba, visor a todo el ancho y,
 * debajo, tiras, efectos y controles en tres columnas. Las zonas están vacías: cada historia pone su
 * contenido dentro de la suya.
 */
export function PanelLayout() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={1} size="h3">
            Mood Table
          </Title>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {/* Ocupa el alto de la ventana bajo la cabecera; las tres columnas se llevan lo que deja el visor. */}
        <Stack h="calc(100dvh - var(--app-shell-header-offset) - 2 * var(--app-shell-padding))">
          <Zone title="Visor" minHeight={200} />
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
