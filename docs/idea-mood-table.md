<!--
Ficha de idea (plantilla docs/PLANTILLA-idea.md) + registro de decisiones.
Fuente viva de la idea: cualquier decisión nueva se anota aquí (§10) con su porqué.
-->

# 🎛️ Mood Table v2

> **Pitch (1 frase):** Un **instrumento de luz** para la mesa de DJ: un motor de efectos propio,
> reactivo a la música y controlable en vivo, con una tira virtual que permite desarrollarlo y
> demostrarlo sin hardware.

**Estado:** ✅ **Elegida** — luz verde del mentor el 22-sep-2026 (ver §9 y D15) · **Fecha:** 09-sep-2026 (act. 22-sep) · **Autor:** Joseba
**Nombre del producto:** **Mood Table** (sin "v2"; la reescritura se cuenta en README §1.1 — D16)
**Origen:** proyecto personal *Mood Table* (2021-2024, repo `7daysofrain/mood-table`), abandonado
por falta de tiempo y porque necesitaba una reescritura total. Esta idea es esa reescritura,
hecha con método (SDD/OpenSpec) y con agentes de código.
**Filtros del post-mortem de Sutegi:** ✅ hay un sistema real que construir sin la IA; ✅ hay código
sustancioso que no es un bucle agéntico (DSP, motor de frames, protocolo, mezcla, estado).

---

## 1. Problema y usuario

- **Problema:** la v1 funcionaba (600 LEDs, dos tiras, control desde una Traktor F1, *music
  responsive*) pero era una **amalgama de piezas ajenas**: Hyperion para la capa de ambiente, la
  librería *dancyPi* para la reactiva, un controller Node orquestándolas por sockets y `spawn`, y
  la configuración repartida en cuatro sitios (JSON de `config`, `effects.js`, JSON de Hyperion,
  `config.py` parcheado con `sed`). Cada pieza tenía su ciclo de vida, su driver y su cuenta de
  LEDs (200 / 186 / "600"). Consecuencia: **no se podían añadir efectos propios** sin meterse en
  las tripas de un tercero, y cualquier cambio era arqueología.
- **Usuario:** el DJ (Joseba) en su mesa. Un solo usuario, un solo instrumento. No hay "cliente".
- **Por qué importa:** la parte artística —tocar parámetros en tiempo real mientras suena la
  música— es lo que da valor al aparato, y es justo lo que la amalgama hacía más difícil de
  extender. El dolor está documentado por el propio autor: "*era muy frankenstein y se me hacía
  complejo*".

## 2. Qué hace el MVP (flujo principal *end-to-end*)

Suena música (fichero o tarjeta de sonido) → el **motor** (proceso sin navegador) la analiza
(FFT, energía por banda, beat) → el **efecto activo** (código propio con parámetros declarados)
produce un frame → el DJ **toca un parámetro** desde el panel web y la luz responde al instante →
el frame se pinta en la **tira virtual** (canvas por WebSocket) **y en la tira real** (serie
Adalight → Light Box) → al apagar y encender, la Pi **vuelve al último estado**.

Back = motor + API · Front = panel de control + tira virtual · Datos = configuración de la tira +
estado del instrumento (persistidos tras un puerto; JSON de inicio).

## 3. Historias de usuario

**Must-have (5):**
1. **Probar el instrumento en el simulador.** Sin hardware, con un fichero de audio o la tarjeta
   de sonido como fuente, elijo un efecto y la tira virtual del navegador reacciona a la música en
   tiempo real. *(Flujo vertebral. Renombrada el 22-sep: el simulador es funcionalidad, no pieza
   aparte — D19.)*
2. **Tocar los parámetros en vivo.** Como DJ, veo los controles del efecto activo (generados
   desde su esquema) y al moverlos la luz responde al instante. *(La parte artística; la razón de
   ser del instrumento.)*
3. **Pintar la tira física.** Como DJ, lo que veo en la tira virtual se reproduce en la tira real
   de la mesa. *(El alma del proyecto. Vía Adalight + Light Box: sin firmware nuevo.)*
4. **Declarar mis tiras.** Como maker, declaro mis tiras en un fichero de configuración (salida,
   nº de LEDs, orden de color, límites de potencia) y el motor y la tira virtual lo respetan. *(La
   "fuente de verdad" del hardware que la v1 nunca tuvo. Cambiado el 22-sep: fichero, no panel — D29.)*
5. **Arrancar en el último estado.** Como DJ, enciendo la Pi sin portátil y vuelve como estaba:
   el efecto de cada tira y sus valores. *(Persistencia de estado del instrumento, no de repertorio.)*

**Should-have (2):**
- **Firmware propio** (ESP8266/ESP32): el motor manda frames a un microcontrolador con firmware
  fabricado por el agente en C++. *(Aquí vive el experimento del eje 3, ver §5.)*
- **Tira de ambiente:** una **segunda tira física** con su propio efecto (normalmente sin audio),
  por Arduino con Adalight o por el firmware propio. *(Corregido el 22-sep: no es una capa mezclada
  sobre la misma tira, es otra tira — D11/D26.)*

**Explícitamente fuera del MVP (visión):** Traktor F1, pantalla táctil, encoder + TFT, presets /
escenas guardadas, sincronía por tempo, más de dos tiras o segmentos, GPIO directo, WiFi. Ver §11.

## 4. Stack tentativo

- **Motor (back):** TypeScript sobre Node (arm64 en la Pi). Bucle de tiempo real con búferes
  preasignados (`Float32Array`/`Uint8Array`, cero `new` en el bucle caliente). FFT propia o
  librería pequeña. Captura de audio en la Pi vía `arecord` → PCM crudo por `stdin` (sin binarios
  nativos); fuente "fichero" = mismo lector sobre un WAV.
- **Panel + tira virtual (front):** app web (React o similar) que genera los controles desde el
  esquema del efecto y pinta la tira en un canvas; habla con el motor por WebSocket (frames y
  estado) y HTTP (comandos, config). **Cero lógica de luces en el navegador.**
- **Datos:** configuración de la tira + estado del instrumento, tras un puerto de persistencia.
  Adaptador JSON de inicio; SQLite (fichero, sin servidor) como adaptador alternativo si conviene
  blindar la sección de BD. *(Decisión D7.)*
- **Salidas de luz:** adaptador **Adalight-serie** (Light Box Dream Color, 115.200 baudios),
  adaptador **WebSocket** (tira virtual), y en should-have adaptador **serie propio** (ESP).
- **Despliegue:** producción en la **Pi 4** de la mesa (proceso bajo `systemd`/pm2, arranque
  autónomo). **Demo pública:** el mismo motor en un servidor con fuente "fichero" y tira virtual,
  con URL, para la evidencia de despliegue de la entrega final. Desarrollo en la **Pi 3 B+**.
- **¿IA dentro del producto?** **No.** Es un instrumento; el valor lo entrega el motor. La IA está
  en el proceso (eje 3), que es donde LIDR la evalúa. Se dice así, sin disfrazarlo.

## 5. Uso de IA — *eje de nota* (1/3 de la evaluación)

- **Enfoque:** *fábrica dirigida por specs con puertas humanas*. Joseba escribe el PRD y las
  specs OpenSpec (escenarios GIVEN/WHEN/THEN); el agente fabrica; los tests y el simulador son
  las puertas por las que tiene que pasar cada cambio antes de que Joseba lo acepte.
  Se declara con honestidad que **hay una pieza de código (el firmware C++) que Joseba no puede
  evaluar**: la valida desde fuera (protocolo, tests en host, la tira pinta lo que debe).
- **En el proceso:** SDD con OpenSpec (`propose → apply → archive`); PRD → backlog → spec →
  código. Reparto de herramientas: **Cowork/Opus** para ideación, decisiones, specs y documentos;
  **Claude Code** para implementación, tests, git. Candidatos a skills/subagentes: skill "nuevo
  efecto" (esquema + render + test de frame dorado), subagente de **firmware** (C++ en un
  lenguaje que Joseba no domina: el experimento controlado, con radio de daño mínimo y protocolo
  definido byte a byte), subagente de **revisión contra spec**.
- **Decisiones validadas por spike** (material de `prompts.md`): rendimiento de Node en la Pi 3
  B+ antes de cerrar la spec del motor.
- **Ajustes humanos ya registrables:** el pivote desde Sutegi (post-mortem), la corrección
  "escenas guardadas → estado del instrumento" (el aparato es de *performance*, no de repertorio),
  la corrección "dos motores peleándose → dos tiras legítimas", la elección TypeScript vs Python,
  la identificación del Light Box como driver Adalight ya existente.
- **En el producto:** no aplica.

## 6. Riesgos y puntos grises

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Rendimiento de Node en la Pi 3 B+** (dev) | Alto si el bucle no cabe en 16 ms | Spike obligatorio antes de la spec del motor (audio sintético → FFT → efecto → mezcla → salida nula; medir ms/frame). Objetivo: <8 ms a 300 LEDs. |
| **Tirones por recolector de basura** | Medio (jitter visible) | Regla de spec: búferes preasignados, cero asignaciones en el bucle caliente. |
| **Techo de fps por Adalight a 115.200 baudios** | Medio (~19 fps a 200 LEDs; ~6 fps a 600) | Fijar LEDs del MVP ≤ 200-300; firmware propio a 921.600 baudios como should-have. |
| **Hardware no montado ahora mismo** | Medio | Todo se desarrolla contra la tira virtual; la tira real entra al final. El Light Box evita firmware nuevo. |
| **Captura de audio en la Pi** (ALSA, id de tarjeta) | Bajo-medio | `arecord` por `stdin`; comprobar `arecord -l` en el spike. |
| **Consumo de la tira vs fuente** (5 V 18 A ≈ 300 LEDs a blanco) | Bajo | Límite de potencia en el motor que escala el brillo del frame. |
| **Revisión automática de E1/E2 y "BD = JSON"** | Medio | Modelo de datos honesto y dibujado (config de tira, estado, esquema de efectos); puerto de persistencia; hablar con el mentor (§9). |
| **Alcance** (F1, TFT, encoder, capa ambiente, WiFi…) | Alto históricamente | Lista explícita de "fuera del MVP" (§11); should-have solo dos. |
| **Evaluación de hardware sin verlo** | Bajo | Vídeo de 2-3 min + demo pública con tira virtual. |

## 7. Atractivo (orgullo / redes)

La mesa de cristal entera convertida en una lámpara que baila con la música, controlada desde el
panel (y en el futuro desde la F1). Demostrable en 2-3 minutos con un vídeo de la mesa y, sin
hardware, con la URL pública: suena un tema, la tira virtual reacciona, se mueve un slider y la
luz cambia. Es un proyecto con historia (posts de Instagram de 2021, la v1 que funcionó) y con
final: "lo reescribí bien".

---

## 8. Scorecard de comparación

| Criterio | Peso | Nota (1-5) | Comentario |
|---|:---:|:---:|---|
| Eje 1 · Idea y arquitectura | Alto | **5** | Sistema real, decisiones de arquitectura de verdad (tiempo real vs control, puertos de entrada/salida justificados por hardware real). No es un CRUD. |
| Eje 2 · Calidad de código viable en plazo | Alto | **5** | DSP, motor, protocolo, efectos como funciones con estado explícito: muy testeable (frames dorados, señales sintéticas, E2E sobre tira virtual). En TS, Joseba puede juzgarlo. |
| Eje 3 · Lucimiento del uso de IA | Alto | **4** | Fábrica dirigida por specs con puertas; experimento de firmware en C++; decisiones por spike; pivote documentado. No hay IA en el producto (y no hace falta). |
| "Completo, no extenso" (flujo E2E cerrable) | Alto | **5** | Un solo flujo, cinco historias, dos should-have. Lista explícita de exclusiones. |
| Factibilidad en fechas (25-sep / 23-oct / 11-nov) | Medio | **4** | E1 es documentación; E2 se cierra contra la tira virtual; hardware al final. Riesgo: Pi 3 B+. |
| Atractivo / orgullo / redes | Medio | **5** | Muy visual, con historia y vídeo. |
| Motivación y dominio conocido | Medio | **5** | Proyecto propio, dominio conocido, deuda pendiente. |
| Riesgo técnico (5 = bajo) | Medio | **3** | Tiempo real en la Pi, audio en Linux, hardware. Mitigado por spike y simulador. |
| **TOTAL** (suma) | | **36/40** | |

**Veredicto rápido:** **Seguir.** Invierte el error de Sutegi: aquí el sistema existe sin la IA y la
IA lo hace posible en plazo (y en C++ donde Joseba no llega). Condiciones: simulador como
must-have de primera, lenguaje decidido con argumentos (hecho: TS), alcance recortado (hecho).

## 9. Preguntas para el mentor

**✅ Respondidas por el mentor el 22-sep-2026:**

- **Persistencia sin BD relacional** → Sí, como "BD o equivalente". Documentar **modelo, puerto y
  cómo probar la persistencia** en el README y en el ticket de BD. SQLite deja el ticket más "clásico".
- **Evidencia de hardware (vídeo 2-3 min + URL con tira virtual)** → Sí, suficiente, **si el README
  dice cómo reproducir la demo web** y el **vídeo muestra el E2E en la mesa**.
- **Sin IA en el producto** → Ningún problema: vale producto y/o proceso.
- **Peso del motor frente a front/BD** → No preocupa **si front + persistencia + motor cierran un
  circuito operable**. No es checklist CRUD; es MVP demostrable.

---

## 10. Decisiones tomadas (09-sep-2026) — con su porqué

| # | Decisión | Porqué |
|---|---|---|
| D1 | **Motor sin navegador**, proceso propio en la Pi/servidor | El navegador es un cliente tonto (panel + tira virtual). Evita atar el audio a APIs del navegador; el mismo motor corre en la Pi y en la demo pública. |
| D2 | **Fuentes de audio como puerto**: tarjeta (`arecord` → `stdin`) y fichero (WAV) | Misma FFT y mismos rasgos en los dos casos; el fichero permite tests deterministas y desarrollo sin hardware. |
| D3 | **Salidas de luz como puerto**: Adalight-serie, WebSocket (virtual), serie propio (should) | Son las tres formas reales de pintar en la mesa; el simulador no es una pieza aparte sino el motor con otro adaptador. |
| D4 | **Efecto = módulo de código** con esquema de parámetros declarado y `render` con estado explícito | Un efecto es un algoritmo, no un dato (así lo hacen Hyperion y dancyPi). El esquema permite al panel generar controles sin conocer el efecto; el estado explícito da tests reproducibles (frames dorados). |
| D5 | **Mandos como puerto**: `setEffect`, `setParam`, … emitidos por el panel hoy y por F1/encoder mañana | Un vocabulario, varios mandos. Los parámetros se aplican en un búfer que el bucle lee al empezar cada frame (nunca a mitad de render). |
| D6 | **Sin escenas/presets guardados** | El aparato es de *performance*; un instrumento no guarda partituras. (Corrección de Joseba sobre una propuesta heredada de Hyperion.) |
| D7 | **Persistencia = configuración de tira + estado del instrumento**, tras un puerto; JSON de inicio, SQLite si conviene | Datos reales sin BD con calzador; el arranque autónomo (H5) los necesita; deja la sección de BD del README defendible. |
| D8 | **TypeScript/Node para el motor**, condicionado a spike en la Pi 3 B+ | Joseba puede leer, criticar y corregir lo que fabrica el agente (eje 2 y objetivo didáctico); tipos compartidos con el front; rendimiento sobrado en teoría (2-6 ms/frame). Python perdía el juicio humano sobre el código. |
| D9 | **Experimento "fabricar en un lenguaje que no domino" reservado al firmware C++** | Pieza pequeña, spec precisa byte a byte, verificable desde fuera; radio de daño mínimo para el eje 2. |
| D10 | **Tira física vía Adalight + Light Box como must-have**; firmware propio como should-have | El Light Box ya es un driver Adalight (era lo que usaba Hyperion): cierra H3 sin firmware ni compras. |
| D11 | ~~Una sola capa (reactiva) en el MVP; capa ambiente mezclada como should-have~~ → **corregida el 22-sep:** el ambiente es una **segunda tira física** con su propio efecto; **no hay mezcla de capas** (ver D26) | Error de redacción arrastrado al README: la v1 ya tenía dos tiras legítimas (§5, "dos motores peleándose → dos tiras legítimas"). Desaparece la mezcla, que era la parte compleja del should-have. |
| D12 | **Número de LEDs del MVP ≤ 200-300**, definido en la config de la tira | Techo de Adalight a 115.200 baudios y fuente de 18 A. La cifra exacta se fija en el spike. |
| D13 | **Spike de rendimiento en la Pi 3 B+** antes de cerrar la spec del motor | La 3 B+ va a la mitad que la 4; si va bien en la 3, sobra en la 4. Decisión validada con datos → `prompts.md`. |
| D14 | **Límite de potencia en el motor** | Lo hacían Hyperion/dancyPi por debajo; ahora es código propio y evita quemar fuente/tira. |

### Decisiones de la sesión de README (22-sep-2026)

| # | Decisión | Porqué |
|---|---|---|
| D15 | **Luz verde del mentor** a Mood Table, con condiciones (§9) | Las condiciones pasan a ser requisitos del README: cómo probar la persistencia (§3 y ticket BD), cómo reproducir la demo web (§1.4), circuito operable panel → motor → tira → persistencia → arranque. |
| D16 | **Nombre: "Mood Table"**, sin "v2" | "v2" tiene sentido en la historia del autor, pero a un lector nuevo le suena a secuela. La reescritura se cuenta en README §1.1. |
| D17 | **Superficie de control del MVP = panel web local** servido por el motor; pantalla táctil y Traktor F1 **fuera del MVP**, pero citados en la descripción como visión (sobre el puerto de mandos) | Tecnología web ≠ internet: el panel funciona sin conexión desde la Pi. Mandos físicos = más hardware y riesgo en E2. El vídeo de demo mostrará el panel web controlando la tira física. |
| D18 | **Público: "DJs y makers"** con una Raspberry y una tira LED, no solo el autor | Evita la lectura "hobby sin usuario". Se sostiene porque la config de tira (H4) y los efectos como módulos hacen el motor reutilizable. **Compromiso:** README §1.4 debe explicar cómo lo monta otra persona. |
| D19 | **El simulador es la H1** ("Probar el instrumento en el simulador"), no una sexta historia | Es funcionalidad real para el maker (probar antes de comprar) y para el evaluador; no se añade como 6.ª para respetar 3-5 must-have. En arquitectura sigue siendo el motor con otros adaptadores (D3). Orden: simulador → tocar → tira real → configurar → autonomía. |
| D20 | **Efectos del MVP: espectro, energía y scroll** (los tres de la v1/dancyPi), reescritos en el motor propio | "Elegir un efecto" necesita más de uno; tres efectos distintos prueban que el esquema de parámetros es general, y demuestran que la nueva arquitectura cubre la v1. Parámetros concretos → spec OpenSpec. |
| D21 | **Adalight antes que firmware propio** (confirma D10); firmware **ESP8266/ESP32** como should-have | Riesgo: el must-have no depende del C++ que Joseba no evalúa; un puerto con dos implementaciones prueba la abstracción; un problema cada vez. Adalight es **protocolo abierto** (Light Box o cualquier Arduino con sketch Adalight), no propietario. Razones del firmware: hardware barato y extendido, más LEDs/fps, camino a WiFi. Ojo: ESP8266 y ESP32 son ambos de 3,3 V → conversor de nivel en los dos. |
| D22 | **Arquitectura: hexagonal ligera** (4 puertos, montaje manual en `main.ts`, sin contenedor de DI), dos planos, un proceso; **Fastify + TypeBox**, React + Vite + TS, HTTP + WebSocket | README §2.1. Contenedor DI y AdonisJS descartados: pocas dependencias elegidas al arrancar; framework en el centro choca con un núcleo de tiempo real. |
| D23 | **Frame tardío = frame saltado** (bucle y Adalight) · **guardado con retardo** del estado · **paquete de tipos compartidos** (monorepo) | README §2.2. En luz en vivo importa ir a tiempo; evita escribir en la SD con cada movimiento; un esquema, dos lados. |
| D24 | **Monorepo con pnpm workspaces** (`shared`, `engine`, `panel`; sin Nx/Turborepo) · regla de lint núcleo ↛ adaptadores · E2E Playwright en `e2e/` · `AGENTS.md` (estándar) + `.claude/` (skills/subagentes) | README §2.3. La frontera motor/navegador la impone la estructura, no la disciplina (clave con agentes). Genérico donde hay estándar, específico donde no. Árbol solo con carpetas y ≤ 2 niveles: no comprometer ficheros concretos. |
| D25 | **Persistencia: SQLite** tras `StateStore` (+ adaptador en memoria para tests). Tablas: `strip_config` y `instrument_state` (fila única, `CHECK (id = 1)`), `effects` (una fila por efecto; valores en `values_json` validados con TypeBox) | README §3. La Pi se desenchufa en caliente: transacciones = nunca un estado a medias. **El código define, la BD guarda lo que decide el usuario**: sin definición de efectos en la tabla (evita dos fuentes de verdad). Configuración base por efecto: fuera del MVP; si llega, con esquema propio tipado, nunca sin esquema. |
| D26 | **La tira es una entidad**: el motor pinta N tiras, cada una con su efecto, límite de potencia y salida; el análisis de audio es común. **MVP demostrado con una tira física (la del Light Box) + la virtual**; la segunda tira es el should-have | Corrige D11. Diseñar para N ahora es texto; rehacer bucle, esquema y API después cuesta mucho más. |
| D27 | **Sin terceros ni GPIO en la v2**: todas las tiras por serie (Adalight con Light Box o Arduino, o firmware propio) pintadas por el motor propio. En la v1: ambiente = Light Box (Hyperion), reactiva = GPIO (dancyPi) | GPIO desde Node = librería nativa + root + código de bajo nivel que Joseba no puede revisar: fuera de un must-have. Qué efecto va en qué tira es configuración, así que el MVP usa la tira del Light Box con efectos reactivos. |
| D28 | **Una sola interfaz `Effect`** con `usesAudio` declarado y `render(ctx: FrameContext{time, dt, audio}, …)` (patrón Strategy); reactivo y ambiente son implementaciones | Uniforme en panel/API/BD; admite híbridos; el análisis se comparte y se omite si ninguna tira lo usa → **el motor funciona sin fuente de audio** (modo ambiente). |
| D29 | **Tiras declaradas en fichero de configuración** (id, nombre, salida y puerto, nº de LEDs, orden de color, límites de potencia), validado con TypeBox al arrancar. **La BD solo guarda estado**: `strip_state` (efecto activo por tira) y `strip_effects` (valores por tira y efecto). Sustituye las tablas de D25 | Lo que sale de la hoja de características y no muta va en fichero versionado; lo que cambia al tocar, en BD. Sin CRUD de tiras (una tira existe porque está cableada). Coste: cambiar hardware = reiniciar; sin FK a tiras → reconciliación al arrancar. |

### Decisiones de la sesión del 23-sep-2026

| # | Decisión | Porqué |
|---|---|---|
| D30 | **Demo pública en AWS EC2 `t4g.micro` (arm64)** + IP elástica + registro `A` en Spaceship (`moodtable.josebaalonso.tech`) + **Caddy** (HTTPS Let's Encrypt) + `systemd`. Mismo `deploy/update.sh` en mesa y demo; **CD con GitHub Actions → SSM** en la demo, manual en la Pi. Bucle pausado sin clientes y 30 fps en la demo; créditos *standard*; solo 80/443, sin SSH. Sin `/health` ni rollback automático (comprobación manual; volver atrás = `update.sh` con la versión anterior). Infra creada a mano y documentada en `deploy/`, sin IaC | README §2.4. Misma arquitectura que la Pi → un solo procedimiento de despliegue y medidas representativas. El motor es un proceso continuo con WebSocket: necesita CPU sostenida y máquina siempre disponible. Experiencia previa del autor en AWS. Descartados en el proceso (ver `prompts.md` §2.4): Render gratis, Fly.io, Lightsail, App Runner (sin WebSocket), Fargate + ALB. `/health` e IaC: excesivos para el MVP (decisión de Joseba) |
| D31 | **Configuración de tiras en JSON** (`deploy/config/demo.json`, `mesa.example.json`; en la Pi `/etc/moodtable/config.json`) · **pista de ejemplo con licencia libre en el repo** · comandos previstos `pnpm dev` / `pnpm test` / `pnpm test:e2e`, puerto 8080 · montaje de hardware en `HARDWARE_SETUP.md` (raíz, pendiente) | README §1.4. TypeBox valida JSON sin parser extra (YAML: comentarios, pero una dependencia más). La pista permite `pnpm dev` y la demo sin aportar audio y sin problemas de derechos. `HARDWARE_SETUP.md` en la raíz: es donde busca un maker. |
| D32 | **Repo propio `7daysofrain/mood-table-v2`** (público), creado vacío y con el **historial conservado** (subido desde la copia local; sin relación de fork). Ideas descartadas (Sutegi, Pura Belia, plantilla de idea) y `PLAN-entregables.md` **fuera del árbol**; siguen en el historial | "No fork" es un dato de GitHub, no del historial: subir el historial a un repo nuevo cumple la regla y conserva los commits como evidencia del proceso (eje 3). `mood-table` ya es la v1 y no se renombra; el **producto** sigue llamándose Mood Table (D16), el "v2" es solo del repo y encaja con la historia de la reescritura (README §1.1). Descartadas fuera: el repo cuenta el proyecto elegido; Pura Belia además describe la empresa del autor. |
| D33 | **LedFx es la referencia más cercana** (Python + React, Pi, panel web, parámetros en vivo, Adalight, *virtuals*, escenas): para el usuario final cubre casi todo el MVP. **Se sigue adelante con dos objetivos primarios: propiedad y aprendizaje.** Público sin cambios (D18): nicho de un instrumento **más sencillo de tocar y orientado al DJ** frente a una plataforma general. LedFx como referencia (ideas, no código; comparación de rendimiento). PRD §1.2 | Descubierto al redactar el PRD (23-sep), no en la selección de la idea. **Lección para `prompts.md`:** el análisis de alternativas debe formar parte de la ficha de idea (la plantilla no lo pedía). No invalida el proyecto (el mentor lo aprobó como reescritura de un proyecto propio y se evalúan método, arquitectura y código), pero esconderlo sí sería un error. |
| D34 | **Decisiones del PRD (v1.0)**: PRD = fuente de verdad de alto nivel (qué y por qué; requisitos y GIVEN/WHEN/THEN en backlog y OpenSpec) · lo que exige la entrega (demo pública) va al README, no al PRD · usuarios DJ + maker (sin cambios, D18) · expectativas E1-E9 sin cifras (umbrales técnicos a las specs) · **cambiar de efecto pasa a H2** · **efecto de ambiente *respiración* en el MVP** (cierra E3; amplía D20) · **sincronía con el tempo y presets: fuera por decisión** · **en el MVP se toca desde un portátil** (provisional) · vocabulario: **tira virtual** (salida virtual) ≠ **visor** (vista del navegador); "estado" solo como estado del instrumento; la memoria del efecto es `createMemory` | PRD §1-§8 (`docs/PRD.md`, 23-sep). README alineado el mismo día (§1.1 alternativas, §1.2, §1.3, §2.1, §2.2 y demás usos de "tira virtual"). |
| D35 | **Herramienta de gestión: Linear** (GitHub Issues + Projects y Jira descartados). Reparto de fuentes de verdad: **PRD** = qué y por qué · **Linear** = backlog, jerarquía, prioridad, estimación, estado y **criterios de aceptación de cada historia en GIVEN/WHEN/THEN** · **OpenSpec** = el *cómo* de cada cambio (requisitos y escenarios derivados de esos criterios, diseño, tareas). Jerarquía del curso: **PRD → Épica (Proyecto de Linear, una por H#/S#) → Historia (issue, 1-2 días) → Tarea (sub-issue)**; las *initiatives* de Linear no contienen issues. Proceso en `docs/instructions/workflow.md`. Enlace con GitHub por la integración nativa (rama con ID o palabras clave `Fixes`/`Refs MOO-n`; estado automático; *linkback* en la PR). **Sin** sincronización con GitHub Issues (duplicaría). El evaluador tendrá acceso al tablero | GitHub no tiene tipos de issue en repos personales (solo organizaciones; sub-issues sí) y su modelo es pobre para la jerarquía que pide la ejecución autónoma (PRD → epic → historia → tarea). Linear es la herramienta del máster (módulo 4, doc 04.5): jerarquía nativa, MCP oficial, integración con GitHub. Coste: Linear es privado → se compensa con el acceso al evaluador, el README §5/§6 y los *linkbacks* públicos en las PR. |

## 11. Fuera del MVP (visión, por orden de deseo)

1. Traktor F1 como mando físico (adaptador HID sobre el puerto de mandos; la v1 ya lo tenía).
2. Firmware propio en ESP32 con WiFi (sin cable serie).
3. Más de dos tiras / segmentos (perímetro, bajo tablero) con efectos distintos (el modelo ya
   admite N tiras; la segunda es should-have).
4. Adaptador GPIO directo (`rpi_ws281x`): código nativo y root; solo si compensa frente a serie.
5. ~~Sincronía por tempo (BPM) y efectos "a compás".~~ → fuera por decisión (PRD §5.4, D34).
6. Pantalla táctil en la mesa (la UI de la v1) y encoder + TFT.
7. ~~Presets/escenas~~ → fuera por decisión (PRD §5.4, D34); se revisaría si el uso lo pide.

## 12. Diagnóstico de la v1 (para README §1.1 y `prompts.md`)

Repo `mood-table` (Nx monorepo, 2021-2024): controller Node con estado MobX y tres "vistas"
(Hyperion por JSON-TCP, dancyPi por `python-shell`, Traktor F1 por HID), UI React+MUI por
WebSocket, Arduino con encoder + TFT por serie (protocolo a medias). Lo que faltaba no era
calidad de código sino **una pieza central**: un motor propio con su modelo de tira y de estado.
Sin ella, todo lo demás la suplía con sockets y `spawn`. El repo v1 se conserva como referencia
(efectos y parámetros de `effects.js`, protocolo `knob_changed`, scripts de setup de la Pi).

## 13. Inventario de hardware (09-sep-2026)

- **Conexión de las tiras en la v1 (22-sep):** la tira de **ambiente** iba por el **Light Box**
  (Hyperion) y la **reactiva** por **GPIO** de la Pi (dancyPi). En la v2 todo va por serie: la tira
  del Light Box es la del MVP; la de GPIO se **recableará a un Arduino** (Adalight) o al ESP cuando
  entre como segunda tira.
- **Producción:** Raspberry Pi 4 (en la mesa) + Light Box Dream Color (USB→LED, Adalight) +
  Mean Well LRS-100-5 (5 V, 18 A) ×2 + tiras LED (varias, tipo por confirmar) + tarjeta de sonido
  USB (entrada: salida del mixer).
- **Desarrollo:** Raspberry Pi 3 Model B+, Arduino Uno ×2, NodeMCU V3 (**ESP8266**, 3,3 V →
  necesita conversor de nivel), encoders KY-040 ×2, OLED 0,91", TFT ST7789 1,3".
- **Por comprar si hace falta:** ESP32 (tienda del barrio, de un día para otro), conversor de
  nivel 3,3→5 V.

## 14. Primeros pasos técnicos (antes de la E2)

1. **Spike de rendimiento** en la Pi 3 B+ (D13). Salida: ms/frame a 200/300/600 LEDs, 30/60 fps.
2. **Adalight con el Light Box**: script mínimo que manda un frame fijo y otro animado; confirma
   baudios, orden de color y LEDs reales.
3. **Captura de audio**: `arecord -l`, latencia y formato con la tarjeta USB en la Pi.
4. Con los tres datos, cerrar la spec del motor (OpenSpec) y la config de la tira.
