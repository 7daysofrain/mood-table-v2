import { Badge } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';

import classes from './AlertTag.module.css';

/**
 * Etiqueta de aviso de la cabecera (decisión 5 del change soundcard-reconnect): roja, parpadeando
 * una vez por segundo para que salte a la vista, y fija si el sistema pide menos movimiento. Es una
 * alerta: el lector de pantalla la anuncia al aparecer. El texto es un parámetro, para que otra
 * pieza de hardware pueda avisar igual (Q5).
 */
export function AlertTag({ label }: Readonly<{ label: string }>) {
  // Sin SSR: el primer render ya sabe si parpadear.
  const reduceMotion = useReducedMotion(false, { getInitialValueInEffect: false });
  return (
    <Badge
      role="alert"
      color="red"
      variant="filled"
      className={classes.tag}
      data-blink={reduceMotion ? undefined : true}
    >
      {label}
    </Badge>
  );
}
