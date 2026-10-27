# Design

> Decisiones tomadas al explorar el change con el usuario (27-oct), a partir de `MOO-74`, de PB y de
> D64-D73. Todas son de la única tarea, `MOO-89`.

## Context

- **Lo que hay** (README §2.2, D73): un driver que cada 60 s lista las PR abiertas contra `main`
  (`GET /pulls`), decide qué hilos arrancan, se olvidan o vuelven a empezar, y reanuda cada uno con una
  foto. El grafo (un hilo por PR) no consulta GitHub. El estado está en memoria (`MemorySaver`): al
  reiniciar se reconstruye desde GitHub.
- **Lo que no puede cambiar:** el PAT de GitHub es de solo lectura y el sistema no escribe en GitHub
  (`specs/pr-tracking`, D71). La señal de detener la pone una persona y el sistema solo la lee.
- **Lo que GitHub da, comprobado el 27-oct:**
  - `GET /pulls` ya devuelve las etiquetas de cada PR (`labels`, en `test/fixtures/github/open-pulls.json`
    vacías). Leerlas no cuesta ninguna petición más.
  - *«Anyone with triage access to a repository can apply and dismiss labels»*. El repo es de una
    cuenta personal (`7daysofrain`), sin rol *triage*: solo el dueño y los colaboradores, que tienen
    escritura, etiquetan. Quien abre una PR desde fuera no puede etiquetar ni la suya.
  - La etiqueta `babysitter:stop` no existe todavía en el repo.
- **Una trampa del grafo actual:** la espera de 30 min cuenta desde que el hilo vio el push
  (`afterChecksWait`, `afterReviewWait`). Un hilo que se quedara parado en su `interrupt()` y se
  reanudara una hora después recibiría una foto con `observedAt` muy posterior al push, y la PR pasaría
  a «necesita intervención» por tiempo nada más reanudarla.

## Goals / Non-Goals

**Goals:**

- Que la guarda de «PR detenida» viva en **un solo sitio**, y que la respeten sin más trabajo los nodos
  que lleguen con BH2-BH5 (triaje, arreglos, escalado, petición de revisión).
- No tocar el flujo del grafo ni sus reglas puras.
- Que ninguna PR con la etiqueta avance más allá de terminar lo que ya estaba en curso, pase lo que
  pase con Linear o con GitHub.

**Non-Goals:**

- Un estado «detenida» visible en LangGraph Studio: el grafo no sabe que una PR está detenida.
- Persistir qué PR están detenidas: lo dice la etiqueta, que está en GitHub (D66). No depende de
  `MOO-85`.

## Decisions

### 1. La señal es la etiqueta `babysitter:stop`, leída con las PR abiertas

- **El adaptador de GitHub** añade las etiquetas de cada PR a `OpenPullRequest` (`labels: string[]`).
  El núcleo decide si una PR está detenida (`isStopped`), igual que ya decide con `isTracked` si la
  sigue. El nombre de la etiqueta es una constante del núcleo, junto a esa regla: es la señal del
  dominio, y el aviso de seguimiento la necesita para decir cómo detener una PR (decisión 3).
- **Permisos:** no hay nada que comprobar en el código. Solo quien tiene escritura puede poner o quitar
  la etiqueta, y el sistema no atiende a nada más: ni a comentarios ni a otras etiquetas.
- **Por qué es declarativa:** la etiqueta es el estado deseado. El driver la vuelve a leer en cada
  vuelta y converge hacia ella, también tras un reinicio. Una orden (un comentario) que falla se pierde;
  la etiqueta no. Y como viene en la misma respuesta que la lista de PR, el driver no puede avanzar una
  PR sin haber visto antes su etiqueta.
- **Alternativas descartadas** (al explorar, 27-oct):
  - *Un comando en un comentario* (`/babysitter stop`): cualquiera comenta en un repo público, así que
    el sistema tendría que comprobar los permisos del autor y leer todo el historial de comentarios en
    cada vuelta. Además mete ruido donde lee Codex.
  - *Un workflow de GitHub Actions* que pone y quita la etiqueta desde un comentario o una casilla: da
    un verbo y una confirmación inmediata, pero añade una orden que puede fallar, un token con
    escritura (`issues: write`) que se dispara también con comentarios de fuera, y una lógica (el
    permiso) en YAML que Vitest no prueba. La etiqueta sigue haciendo falta debajo.
  - *Pasar la PR a borrador*: ya la deja de seguir, pero significa «no está lista» (Codex no revisa los
    borradores) y al volver avisa «La sigo», no «Reanudada».
  - *Un commit status del sistema* para ver en la PR el estado efectivo: obliga a escribir en GitHub
    (*Commit statuses: write*), cambia el requisito «El sistema no escribe en GitHub» y matiza D71.
    La confirmación llega por Linear.
- **Debería ser D74** en `docs/idea-mood-table.md` §10.

### 2. Detener y reanudar viven en el driver; reanudar es empezar desde el último push

El driver decide, en cada vuelta y para cada PR que sigue, según la etiqueta y su hilo:

| Etiqueta | Hilo | Qué hace el driver |
|---|---|---|
| sí | no tiene (al arrancar, o un borrador que pasa a listo) | Nada: la apunta como detenida, sin aviso |
| sí | parado en un `interrupt()` | Avisa «Detenida» y olvida el hilo |
| sí | con un aviso pendiente (`next` sin `interrupt`) | Reintenta el aviso; cuando sale, avisa «Detenida» y olvida el hilo |
| sí | terminado (estado final) | Avisa «Detenida» y **conserva** el hilo: no tiene nada en curso |
| sí, ya avisada | cualquiera | Nada, tampoco con un push nuevo |
| no, estaba detenida | no tiene | Avisa «Reanudada» y empieza un hilo nuevo sin el aviso de seguimiento |
| no, estaba detenida | terminado, mismo SHA | Solo avisa «Reanudada»; vuelve a esperar un push |
| no, estaba detenida | terminado, SHA nuevo | Avisa «Reanudada» y empieza otra ejecución sin el aviso de seguimiento |
| no | — | Como hoy |

- **La guarda está en `advance`:** una PR con la etiqueta nunca se reanuda con `Command({ resume })` ni
  arranca ejecución. Como todos los nodos, también los de BH2-BH5, solo corren cuando el driver
  reanuda un hilo, ninguno avanza en una PR detenida.
- **«Lo que estaba en curso termina»** es, en este grafo, un nodo de aviso que el canal no aceptó: el
  único trabajo que queda a medias entre vueltas. Se reintenta antes del aviso «Detenida», así que el
  mantenedor recibe los dos en orden. Un hilo parado en un `interrupt()` no tiene nada en curso.
- **Reanudar es empezar desde cero, no continuar el hilo.** Así el tiempo de espera cuenta desde que se
  reanuda (la trampa del *Context*) sin tocar las reglas puras, y el grafo no necesita nodos ni ramas
  de «detenida» en cada espera. El único cambio en el grafo es una entrada opcional que omite el aviso
  de seguimiento en una ejecución nueva, porque el driver ya ha avisado «Reanudada».
- **La excepción del estado final** (decidida con el usuario): si la PR ya tenía su estado final y su
  SHA no ha cambiado, reanudar no repite los avisos de comprobaciones y estado final de algo que el
  mantenedor ya sabe. Por eso al detenerla se conserva el hilo terminado: el driver compara su SHA al
  reanudar, igual que ya hace con los pushes.
- **Alternativa descartada:** continuar el hilo donde estaba, con nodos `avisarDetenida`,
  `esperarReanudacion` y `avisarReanudada`, una rama «detenida» en cada espera (y en cada nodo futuro)
  y un reajuste de la hora del push al volver. Se ve en Studio, pero es más grafo, más estimación y una
  guarda repetida en cada nodo.
- **Matiza D73** (el driver olvida el hilo de una PR detenida y la reanuda como un push nuevo). Debería
  ser **D75**.

### 3. Los avisos de detener y reanudar los manda el driver, y no se pierden

- Dos avisos de PR nuevos en `notice.ts`, `stopped` y `resumed`, con su texto en `noticeSummary`. Van a
  la tarea de la PR como los demás; el adaptador de Linear no cambia.
- **No se pierden, con una cola por PR:** el driver apunta la transición (detenida o reanudada) en
  cuanto ve la etiqueta, y encola su aviso. Antes y después de avanzar una PR, publica en orden los
  avisos que tenga en cola; si Linear rechaza uno, queda en la cola con los siguientes y la PR no
  avanza hasta que salgan. Así, si alguien quita la etiqueta antes de que salga «Detenida», el
  mantenedor recibe «Detenida» y después «Reanudada», y la espera cuenta desde que se reanuda. Puede
  llegar dos veces, como cualquier aviso (`specs/pr-tracking`). Una PR que deja de seguirse se olvida
  con su cola.
  - *Corregido tras la revisión de Codex en la #78:* la primera versión apuntaba la transición solo
    cuando su aviso salía. Con Linear caído, quitar la etiqueta reanudaba el hilo antiguo sin ningún
    aviso y con la espera contando también el rato detenida.
- **Al reanudar con una ejecución nueva**, el driver lee primero la foto, después encola «Reanudada» y
  arranca la ejecución sin aviso de seguimiento, que no avisa de nada. Si la lectura falla, no se
  encola nada y se repite en la vuelta siguiente.
- **Para descubrir la etiqueta**, el aviso de seguimiento termina con cómo detener la PR («Para
  detenerla, ponle la etiqueta `babysitter:stop`»), y el de «Detenida», con cómo reanudarla. Lo
  completa la etiqueta, con una descripción clara en el selector de GitHub, y el README.

### 4. Qué PR están detenidas se guarda en memoria y se reconstruye de las etiquetas

- El driver guarda un conjunto de PR detenidas, junto al de PR con hilo. No se persiste: al arrancar,
  toda PR con la etiqueta entra en el conjunto **sin aviso** (primera fila de la tabla), así que una PR
  detenida antes de parar el sistema o mientras estaba parado sigue detenida y en silencio.
- Una PR detenida que se cierra, se integra o vuelve a borrador sale de los dos conjuntos sin aviso,
  como hoy.
- Si alguien quita la etiqueta mientras el sistema está parado, al arrancar la PR se sigue como
  cualquier otra, con el aviso «La sigo»: es el aviso repetido tras un reinicio que ya acepta D73.

## Las cinco decisiones de arquitectura

| Decisión | En esta historia |
|---|---|
| **1. Qué se reparte entre agentes** | Nada: sigue sin haber agentes. |
| **2. Qué contexto recibe cada uno, y si es incorrecto** | El driver ve las etiquetas en la lista de PR; el grafo no sabe que existen. |
| **3. Dónde vive el estado, y si algo falla a mitad** | La etiqueta, en GitHub, es el estado deseado; el driver guarda en memoria qué ha avisado. Un aviso que falla se reintenta en la vuelta siguiente sin que la PR avance (decisión 3). |
| **4. Qué decisiones no necesitan LLM** | Todas: si está detenida, qué aviso toca y si se reanuda desde cero. |
| **5. Cuándo vuelve el control a la persona** | Cuando quiere: poner la etiqueta le devuelve la PR, y quitarla se la vuelve a dar al sistema. |

## Risks / Trade-offs

- **[Al reanudar se pierde la memoria del hilo]** → Hoy no hay memoria entre pushes que importe. BH3 y
  BH4 la necesitarán (D73): entonces el driver dejará de olvidar el hilo y solo dejará de reanudarlo, y
  el tiempo de espera se reajustará al volver. Se anota al refinar esas historias.
- **[Si el repo pasa a una organización, el rol *triage* también podría etiquetar]** → El criterio
  pide permiso de escritura y *triage* está por debajo. Se acepta mientras el repo sea personal; si
  cambia, se revisa.
- **[Detener y reanudar dentro de la misma vuelta de 60 s no se ve]** → Aceptado (proposal,
  *Non-goals*): no hay nada que avisar.
- **[Hasta 60 s entre poner la etiqueta y el aviso «Detenida»]** → Es la cadencia del *polling*
  (D66). En ese tiempo solo puede terminar lo que ya estaba en curso.
- **[Alguien borra o renombra la etiqueta en el repo]** → Las PR detenidas la pierden y se reanudan
  con su aviso: el mantenedor se entera por Linear.
- **[Un aviso «Detenida» que Linear rechaza una y otra vez]** → La PR no avanza mientras tenga la
  etiqueta; el aviso se reintenta en cada vuelta, como los demás.

## Migration Plan

1. **Antes de la prueba a mano**, crear la etiqueta en el repo (el usuario, o el agente si se lo pide):
   `gh label create "babysitter:stop" --description "El PR Babysitter deja de seguir esta PR mientras la tenga"`.
2. **Desplegar:** reconstruir la imagen y `docker compose up -d` (README §2.4). No hay nada que
   migrar: el estado se reconstruye de las etiquetas al arrancar.
3. **Volver atrás:** la imagen anterior ignora las etiquetas y vuelve a seguir todas las PR.
