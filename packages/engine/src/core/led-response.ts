/**
 * La respuesta del LED (decisión 1 del change power-limit, D108): para cada valor de pantalla de un
 * canal, de 0 a 255, el ciclo de PWM con el que se enciende en la tira. Es la gamma 2,0 de la v1: un
 * LED da una luz proporcional a su ciclo y una pantalla no, así que sin ella los colores tenues que
 * en el visor casi no se ven brillarían en la tira.
 *
 * Vive en el núcleo porque la usan dos: la salida Adalight, para codificar cada canal, y el límite
 * de potencia, para estimar lo que consume el frame (un LED consume en proporción a su ciclo).
 */

/**
 * `round(255 · (v/255)²)` para los 256 valores. Da lo mismo que la `gamma_table.npy` de la v1
 * (dancyPi, `0906e77`), valor a valor. Por debajo de 12 sale 0.
 */
export const LED_RESPONSE: Uint8Array = Uint8Array.from({ length: 256 }, (_, value) =>
  Math.round(255 * (value / 255) ** 2),
);
