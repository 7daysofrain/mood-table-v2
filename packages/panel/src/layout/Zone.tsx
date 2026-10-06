import { Paper, Title } from '@mantine/core';
import { type ReactNode, useId } from 'react';

interface ZoneProps {
  /** Nombre de la zona en el glosario (PRD §8): es su título y su nombre accesible. */
  title: string;
  /** Altura mínima, para que la zona se vea aunque esté vacía. */
  minHeight?: number;
  /** Contenido que pone la historia que rellena la zona. */
  children?: ReactNode;
}

/**
 * Una zona del panel: una región con nombre (`<section aria-labelledby>`) que las historias y sus
 * tests localizan por su título (specs/panel-layout).
 */
export function Zone({ title, minHeight, children }: ZoneProps) {
  const titleId = useId();

  return (
    <Paper component="section" aria-labelledby={titleId} withBorder p="md" mih={minHeight}>
      <Title id={titleId} order={2} size="h4" mb="sm">
        {title}
      </Title>
      {children}
    </Paper>
  );
}
