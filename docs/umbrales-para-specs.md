# Umbrales técnicos para las specs (salen del debate del PRD §3, 23-sep)

El PRD fija expectativas sin cifras; estas se derivan en la spec del motor y se validan en el spike.

- **E1 (control → luz):** ≤ 100 ms, umbral de respuesta "instantánea" (Nielsen, https://www.nngroup.com/articles/response-times-3-important-limits/).
- **E2 (sonido → luz):** ≤ 45 ms, umbral de detección cuando la imagen va por detrás del sonido (ITU-R BT.1359; https://en.wikipedia.org/wiki/Audio-to-video_synchronization). Exigente: Adalight a 115.200 baudios tarda ~50 ms en mandar 200 LEDs → puede condicionar nº de LEDs por tira o adelantar el firmware propio. Medir en el spike.
- **E1/E2 (sin tirones):** ningún tirón visible en 1 h de sesión (prueba de uso).
- **E6 (autónomo):** recupera siempre el último estado, también tras corte brusco; luz en ≤ 60 s desde enchufar (depende del arranque de la Pi).
- **E7 (sin hardware):** de clonar a ver el simulador en ≤ 10 min siguiendo la documentación.
- **E8:** ningún frame por encima del límite de potencia declarado (test automático).
- **E9:** un efecto nuevo = un módulo y su test, sin cambios en motor, panel ni BD.
