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
        <Stack>
          <Zone title="Visor" minHeight={200} />
          <SimpleGrid cols={3}>
            <Zone title="Tiras" minHeight={400} />
            <Zone title="Efectos" minHeight={400} />
            <Zone title="Controles" minHeight={400} />
          </SimpleGrid>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
