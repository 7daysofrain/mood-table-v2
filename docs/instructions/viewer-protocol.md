# Protocolo del visor

> Fuente de verdad del **formato** de los mensajes que el motor envía al panel por WebSocket. El
> **comportamiento** (quién recibe qué y cuándo) está en la spec `viewer`; el **código** que codifica
> y decodifica, en `packages/shared/src/viewer-protocol.ts`, que usan el motor y el panel. Si cambia
> el formato, cambian este documento y ese código en la misma PR.
>
> Origen: change `virtual-strip-breathing`, `design.md` decisiones 10 y 11 (`MOO-17`).

## Conexión

- **Una sola conexión WebSocket por navegador**, en la ruta `/ws` del motor (la misma dirección que
  sirve el panel). Por ella viajan los frames de todas las tiras, y más adelante otros mensajes.
- Los mensajes van en **binario**. El primer byte dice de qué tipo es el mensaje.
- El panel no necesita saber nada de antemano: cada mensaje dice de qué tira es y cuántos LEDs tiene.

## Mensaje de frame (tipo `1`)

Un mensaje por cada frame de cada tira: en cada pulso del motor, un mensaje por tira.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `1` (frame) |
| 1-4 | 4 | `seq` | Número del pulso, entero sin signo de 32 bits, **big-endian**. Es el mismo para todas las tiras de un pulso y para todos los navegadores. Tras 2³² − 1 vuelve a 0 |
| 5 | 1 | Índice de la tira | Posición de la tira en el fichero de configuración: `0`, `1`… (como mucho 255) |
| 6… | 3 × LEDs | Colores | RGB, 3 bytes por LED, en el orden de la tira. El número de LEDs es (longitud − 6) ÷ 3 |

Ejemplo: el frame con `seq` 260 de la primera tira, con dos LEDs, rojo y azul:

```
01  00 00 01 04  00  ff 00 00  00 00 ff
```

- Los colores van siempre en **RGB**, sea cual sea el orden de color de la tira física (eso lo
  resuelve su salida Adalight).
- Un hueco en los `seq` que recibe un navegador son pulsos que el motor se ha saltado.
- El índice no se queda desfasado: las tiras solo cambian al reiniciar el motor, y un reinicio obliga
  al panel a reconectar.

## Qué hace el panel con un mensaje que no entiende

Lo ignora. Un mensaje se rechaza si su tipo no es `1`, si es más corto que la cabecera (6 bytes) o si
sus colores no son un número entero de LEDs (al menos uno).
