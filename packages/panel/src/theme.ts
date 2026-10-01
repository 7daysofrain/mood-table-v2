import { createTheme } from '@mantine/core';

/**
 * Tema de Mantine del panel: el único sitio para colores, espaciados y tipografía propios. De momento
 * usa los valores por defecto; el esquema de color (solo oscuro) se fija en el `MantineProvider`.
 */
export const theme = createTheme({});

/** El panel solo tiene tema oscuro (design.md, decisión 3). */
export const colorScheme = 'dark';
