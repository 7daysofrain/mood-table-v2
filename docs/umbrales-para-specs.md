# Umbrales técnicos para las specs (salen del debate del PRD §3, 23-sep)

El PRD fija expectativas sin cifras; estas se derivan en la spec del motor y se validan en el spike.

- **E1 (control → luz):** ≤ 100 ms, umbral de respuesta "instantánea" (Nielsen, https://www.nngroup.com/articles/response-times-3-important-limits/).
- **E2 (sonido → luz):** ≤ 45 ms, umbral de detección cuando la imagen va por detrás del sonido (ITU-R BT.1359; https://en.wikipedia.org/wiki/Audio-to-video_synchronization). Exigente: Adalight a 115.200 baudios tarda ~50 ms en mandar 200 LEDs → puede condicionar nº de LEDs por tira o adelantar el firmware propio. ~~Medir en el spike.~~ → **No se midió en el spike** (`MOO-12`, non-goal): depende de Adalight y queda para H3.
- **E1/E2 (sin tirones):** ningún tirón visible en 1 h de sesión (prueba de uso).
- **E6 (autónomo):** recupera siempre el último estado, también tras corte brusco; luz en ≤ 60 s desde enchufar (depende del arranque de la Pi).
- **E2/E6 (la tarjeta de sonido se pierde en plena sesión, `MOO-59`):**
  - **Aviso en el panel:** < 1 s desde la pérdida, el límite de Nielsen para que una respuesta no corte el hilo del usuario (mismo artículo que E1). En la práctica son decenas de ms: `arecord` termina en el acto y el mensaje de estado sale enseguida (D61).
  - **Recuperación:** < 3 s desde que el sistema ve la tarjeta hasta que la luz vuelve a seguir la música. Medido en la Pi el 22-oct, en tres desconexiones: desde que la tarjeta aparece hasta el primer audio, 394, 414 y 434 ms (ALSA aún contesta `No such device` unos 100-140 ms, y `arecord` tarda unos 275 ms en entregar el primer bloque). El peor caso con un reintento por segundo (D60) son unos 1,6 s; el DJ fijó 3 s, con margen. No cuenta lo que tarda el USB en presentar la tarjeta (1,1-2,1 s en la prueba), que no depende del motor. Descartado: reintentar cada 0,5 s para bajar a unos 1,1 s.
- **E7 (sin hardware):** de clonar a ver el simulador en ≤ 10 min siguiendo la documentación.
- **E8:** ningún frame por encima del límite de potencia declarado (test automático).
- **E9:** un efecto nuevo = un módulo y su test, sin cambios en motor, panel ni BD.
