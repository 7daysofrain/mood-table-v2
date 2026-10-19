> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Esperamos un máximo de 3 por sección, principalmente los de creación inicial o  los de corrección o adición de funcionalidades que consideres más relevantes.
Puedes añadir adicionalmente la conversación completa como link o archivo adjunto si así lo consideras


## Índice

0. [Flujo de trabajo con IA](#0-flujo-de-trabajo-con-ia) · [0.1 Mantenimiento del arnés](#01-mantenimiento-del-arnés) · [0.2 OpenSpec](#02-openspec-inicialización-y-configuración) · [0.3 Hook `validate-ac`](#03-hook-validate-ac-moo-36)
1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## 0. Flujo de trabajo con IA

> Sección añadida a la plantilla: resume cómo se ha usado la IA en todo el proceso (lo pide la evaluación: herramientas, modelos por fase, skills/subagentes/comandos y ajustes humanos).

**Herramientas y modelos por fase:**

| Fase | Herramienta | Modelo | Para qué |
|---|---|---|---|
| Ideación y elección de la idea | Claude (Cowork) + conector de Google Drive (material del curso) | Opus | Comparar ideas con un *scorecard*, post-mortem de la idea descartada, ficha de decisiones con su porqué (`docs/idea-mood-table.md`) |
| Documentación de la E1 (README §0-§3, PRD) | Claude (Cowork) | Opus (`claude-opus-5-5`) | Redacción sección a sección, *research* con fuentes (PRD frente a SRS, hosting, seguridad) y revisión crítica |
| Diseño del panel | Claude Design (artefacto de tipo *Design*) | — | Wireframe de baja fidelidad (`docs/img/panel-wireframe.png`) |
| Herramienta de gestión | Claude (Cowork) + MCP de Linear + navegador integrado | Opus | Elegir Linear y configurarlo (estados, etiquetas, automatizaciones con GitHub) |
| Arnés y backlog (en el repo) | **Claude Code** (app de escritorio) + MCP de Linear | `claude-opus-5-5` en la sesión principal · subagentes: `poke-holes` en **Opus**, `estimator` en **Sonnet** | `AGENTS.md`, skills y subagentes, historias en Linear, README §5-§6, commits |
| E2 y E3 *(previsto)* | Claude Code + OpenSpec | Opus para specs, Sonnet para implementar | Spec-Driven Development: `propose → apply → archive`, con tests y SonarQube como puertas |

Reparto: **Cowork** para idear, investigar, decidir y redactar documentos; **Claude Code** para todo lo que toca el repo como repo (git, Linear con reglas de permisos, código y tests).

**Skills, subagentes, rules y comandos personalizados:**

- **`AGENTS.md`** (estándar abierto) con el contexto y las 4 bases de trabajo; `CLAUDE.md` solo lo importa (`@AGENTS.md`). Un **índice** apunta a `docs/instructions/` (`workflow.md`, `linear.md`, `course.md`), que el agente lee *cuando toca*, no siempre. Solo contiene lo que hace falta en cada sesión; el resto se lee bajo demanda (§0.1).
- **Tres skills de invocación manual** (`.claude/skills/`), una por estado de Linear: `/create-story` → `/refine-story` → `/estimate-story`. Son manuales a propósito: cada paso empieza con una decisión humana. Escritas con la guía de la *skill-creator*, en inglés; el contenido que generan (Linear) va en español.
- **Subagentes** (`.claude/agents/`): **`poke-holes`** (Opus, solo lectura) busca huecos en una historia **sin ver la conversación**, para no compartir los puntos ciegos del autor; **`estimator`** (Sonnet) estima **a ciegas** en el planning poker. Además, un subagente de exploración contrastó el protocolo de las skills con los documentos del curso (módulo 4 y 11.2).
- **Hook `validate-ac`** (`.claude/hooks/`, `PreToolUse` sobre `save_issue`): bloquea una historia con criterios GIVEN/WHEN/THEN mal formados antes de que llegue a la confirmación humana (§0.3).
- **MCP de Linear** como configuración del proyecto (`.mcp.json`), con **reglas de permisos** versionadas (`.claude/settings.json`): lecturas permitidas, `save_issue`/`save_comment` piden confirmación, el resto (borrados, etiquetas, proyectos…) denegado. Conector de **Google Drive** para el material del curso.

**Cómo se trabaja con la IA (método):**

- **La IA propone, el humano decide.** Cada escritura en Linear pasa por una confirmación; cada commit se enseña antes y espera el OK.
- **El contenido es humano, el formato es de la IA.** El caso feliz de cada historia lo describe el humano en lenguaje natural; la IA lo traduce a Gherkin sin añadir comportamiento.
- **Revisores con contexto limpio.** Los subagentes solo reciben la historia, no la conversación, y la estimación se hace a ciegas: la discrepancia entre cartas es el resultado útil, no se promedia.
- **Una fuente de verdad por dato:** PRD (qué y por qué) · Linear (backlog y criterios) · OpenSpec (cómo) · README (diseño y entrega) · ficha (decisiones con su porqué).
- **Se mide y se ajusta el propio arnés.** Ejemplo: `poke-holes` se rehízo tras analizar su primera ejecución y se comprobó en las dos siguientes (§5.2).
- **Todo queda registrado:** decisiones D1-D36 en la ficha, prompts literales (máx. 3 por sección) aquí, y los prompts descartados se quedan fuera del repo.

**Ajustes humanos más relevantes (resumen):**

- **Producto:** el PRD es un documento de negocio, no de requisitos (§5.0); la demo pública es una exigencia de la entrega y va al README, no al PRD; LedFx cubre casi todo el MVP, así que el porqué pasa a ser propiedad y aprendizaje; oír el fichero de audio entra en el MVP (§5.2).
- **Arquitectura:** hexagonal ligera sin contenedor de DI; tiras en fichero y SQLite solo para el estado; Fly.io → EC2 `t4g` para que la demo corra en arm64 como la Pi; SonarQube Cloud + Dependabot porque Sonar gratis no analiza dependencias.
- **Proceso:** Linear en un solo proyecto y tarea = PR, paso = commit (§6.0); tres skills separadas y en inglés (§5.1); backlog refinado justo a tiempo, solo H1 (§5.2); ticket de BD en H5 tras una auditoría, no forzado en H1 (§6.1); escala de estimación 1-13 y layout del panel sacado a *enablers* tras el planning poker (§6.1); el *loopback* de ALSA en CI queda como deuda técnica explícita (§6.1).

### 0.1 Mantenimiento del arnés

**Prompt 1:**

> ok, pasamos a restructurar el AGENTS.md. ¿Que pasos aconsejas?

*Claude Code (`claude-opus-5-5`, 30-sep, tarea `MOO-30`). Tras la E1, `AGENTS.md` tenía 412 líneas que cada sesión cargaba enteras: reglas, requisitos del máster, decisiones ya cerradas y el diario de sesiones. La IA propuso un criterio ("en `AGENTS.md` solo lo que un agente necesita en cada sesión y cambia poco"), un inventario bloque a bloque con su destino para que el humano lo validara, y comprobar antes de borrar que cada decisión cerrada ya estaba en la ficha, el PRD o el README.*

**Prompt 2:**

> Idioma: Si, pasamos a inglés
> Diario: borramos
> Agents.md por paquete: De momento no
>
> Empezemos

*Tres decisiones humanas sobre las que la IA había planteado pros y contras. Resultado: `AGENTS.md` en inglés con 88 líneas (reglas, índice, convenciones, "Don't" y un "Current state" que se reescribe en vez de acumularse); requisitos del máster en `docs/instructions/course.md`; diario borrado (queda en git). También se resolvió un conflicto que había pasado desapercibido: LIDR pide una rama por entrega y `linear.md` una rama por tarea. Ahora la rama de entrega hace de rama de integración de las tareas. **Verificación:** una sesión nueva de `claude -p`, sin la conversación, respondió 8 preguntas de control (entrega, Typeform, crear historia, git en Cowork, siguiente tarea, `prompts.md`, ramas, idiomas) citando el fichero y la sección correctos.*

### 0.2 OpenSpec: inicialización y configuración

**Prompt 1:**

> quizas antes de empezar con esta historia podemos inicializar OpenSpec de manera separada. Es trivial y nos permitiría tener el flujo completo con el resto de puntos. Es decir, sacamos OpenSpec como parte de la historia, lo inicializamos y volvemos a empezar ya con openspec listo

*Claude Code (`claude-opus-5-5`, 1-oct, tarea `MOO-31`). La IA había metido la inicialización de OpenSpec dentro de `MOO-28`, cuyo change tenía que escribirse con OpenSpec. Se sacó a un chore propio. Luego el humano propuso dejar la configuración dentro de `MOO-28`, y la IA lo desaconsejó: la primera propuesta se habría generado sin las reglas que debían guiarla. Se quedaron juntas.*

**Prompt 2:**

> no estás acelerando? Todavia no hemos decidido lo de FF y ya estas ejecutando la moo 31?

*La IA respondió una duda del humano (si usar `/opsx:ff`), decidió por su cuenta, lanzó `openspec init` y escribió un borrador de `config.yaml`. Se deshizo todo y se rehízo con una decisión cada vez: perfil sin `ff` (`propose` ya genera todo de una vez), solo comandos y no skills, y una regla `ask` en `.claude/settings.json` (la IA corrigió su propia afirmación de que los comandos solo se lanzan a mano; se probó que la regla la frena). Al revisar el `config.yaml`, el humano preguntó por la versión: el CLI global era la 1.4.1 y la última la 1.14.0. Se actualizó, se leyó el changelog y apareció `/opsx:update`, que se incorporó al perfil. El `context` de `config.yaml` se eliminó, porque duplicaba `AGENTS.md`.*

**Prompt 3:**

> Estoy pensandome lo del español. Todo lo que tiene que ver con openspec, al ser ejecutable por los agentes mas que dirigidos a humanos, no tendrias sentido tenerlo en ingles en vez de en español igual que el resto del arnes?

*La IA defendió el español: la spec es un contrato que el humano revisa en una puerta, sus escenarios salen de criterios de Linear en español y la lee el evaluador. Queda como criterio del arnés en `AGENTS.md`: lo que el humano revisa y aprueba va en español, aunque lo escriba o lo consuma un agente; lo que solo lee un agente, en inglés.*

### 0.3 Hook `validate-ac` (`MOO-36`)

**Prompt 1:**

> Vamos con la MOO-36, dime si necesita spec o puedes ir por tu cuenta

*Claude Code (`claude-opus-5-5`, 6-oct). La IA desaconsejó el OpenSpec change: es arnés, no producto, y las skills y subagentes entraron sin spec. Pero no empezó: la tarea tenía una línea y dejaba abiertas cuatro decisiones (qué llamada intercepta y cómo distingue una historia, bloquear o avisar, qué cuenta como válido, lenguaje y tests), que planteó con su recomendación.*

**Prompt 2:**

> si, me parece bien. Expande la historia primero en Linear

*Ajuste humano: sin spec, el alcance tenía que quedar escrito antes del código. La IA lo llevó a la tarea de Linear (diseño acordado, cuatro escenarios GIVEN/WHEN/THEN, non-goals y DoD de Chore), que pasa a ser su fuente de verdad. Al empezar propuso cambiar el `.mjs` acordado por `.ts`, que Node 24 ejecuta sin build y entra en tipos y lint con el resto del repo; el humano lo aceptó.*

**Prompt 3:**

> si, sigue, pero prepara un worktree

*La IA creó el worktree a mano desde la rama de la entrega (la herramienta de worktrees partía de `main`). Resultado: validador como función pura con 18 tests en `tooling/`, dentro de la cobertura y de Sonar, y una entrada de 25 líneas que lee la llamada y sale con código 2 si hay errores. Se probó a mano con Node 22 y 24: sin descripción pasa, bien formada pasa, sin `Then` bloquea con el escenario y el paso que falta. La IA no podía probarlo en su propia sesión (los hooks se cargan al arrancar), así que preparó un prompt autónomo para una sesión nueva de `claude -p` en el worktree: dos llamadas a `save_issue` contra una issue inexistente, sin riesgo de escribir porque en ese modo el `ask` se deniega solo. Salida: `RESULTADO: OK`.*

---

## 1. Descripción general del producto

### **1.1-1.2. Objetivo y funcionalidades**

**Prompt 1:**

> Me han dado luz verde para Mood Table v2, empezamos a trabajar sobre el documento de entrega? quiero un resumen de lo que vamos a hacer primero y luego vamos punto a punto refinando hasta que estemos contentos, luego lo escribimos y pasamos al siguiente hasta que terminemos. te parece bien?

*Claude (Cowork). Plan del README por dependencias; aviso de que quedan 3 días para la entrega.*

**Prompt 2:**

> Construir el simulador no seria una funcionalidad en si misma? por otro lado los efectos iniciales usaria los 3 que existen actualmente, claro

*El simulador se convierte en la H1, sin añadir una 6.ª historia; se incluyen los 3 efectos de la v1.*

**Prompt 3:**

> No solo es un tema de LEDs y FPS no? es un hardware mas barato y extendido, lo hace mas amplio de poder usar, el Light Box lo veo como muy propietario

*Firmware propio justificado por coste, alcance y fps; Adalight es un protocolo abierto, no propietario.*

### **1.3. Diseño y experiencia de usuario**

**Prompt 1:**

> yo creo que hablamos de interfaces diferentes con diferentes propositos, uno es el del simulador, que deberia ser más técnico, no orientado al performance en live sino al proposito de la demo. Otro es el interface final que usará el DJ, que todavia no está decidido y puede ser incluso un hardware custom. Eso queda fuera del scope de momento. Dime si esto encaja con los criterios de lo que se pide en esa sección: El interface del simulador

*Claude (Cowork). Se fija el alcance de la UX: un único panel técnico para la demo y la mesa (cambian los adaptadores, no la interfaz); la interfaz de performance queda fuera del MVP.*

**Prompt 2:**

> Si, el camino es texto + wireframe. Esto tiene pinta de poder ejecutarse en Claude Design, no?

*El wireframe del panel se hace en Claude Design (artefacto de tipo Design) y se exporta a `docs/img/panel-wireframe.png`.*

**Prompt 3:**

> Si, haz las dos, lo va a completar. En cuanto al los wireframes no comparto los placeholder de [parametro]. Un wireframe no va a comprometer eso, trata de hacer entender como funciona a nivel experiencia. Aporta mas introducir unos parametros "probables" que un placeholder. Cambiemos eso

*Se sustituyen los marcadores del wireframe por parámetros probables, y se definen en §1.2 los códigos H1-H5 de las historias, que el readme ya usaba sin definir.*

### **1.4. Instrucciones de instalación**

**Prompt 1:**

> vale, para las instrucciones de la mesa hay que complementarlas con unas instrucciones de hardware que todavia no tenemos. Pero si que hay que avisar de que van a existir en un fichero llamado HARDWARE_SETUP.md o algo asi

*Claude (Cowork). La IA había escrito la instalación en la mesa dando el montaje por hecho; se añade el aviso de que el montaje del hardware irá en `HARDWARE_SETUP.md` (raíz, pendiente).*

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

**Prompt 1:**

> No, no quiero heredar nada de Sutegi, borralo entero, nos ceñimos al template original que nos pasaron y creamos la esctructura nueva para Mood Table

*Claude (Cowork). Sección 2 reemplazada por la estructura original de la plantilla.*

**Prompt 2:**

> si, igual aqui hexagonal me parece muy overkill, pero dimelo tu, no nos vale con un DI Container?

*Hexagonal ligera con montaje manual en `main.ts`, sin contenedor de DI.*

**Prompt 3:**

> No no, la capa ambiente está en otra tira de leds separada. Esto es importante. Si no lo hemos tenido en cuenta dime el impacto del cambio en el documento/proyecto primero antes de hacer nada

*La tira pasa a ser una entidad (N tiras); se rehacen la 1.2, 2.1, 2.2 y 3.*

### **2.2. Descripción de componentes principales:**

**Prompt 1:**

> El stack Front ok, todos viejos amigos
> Fastify no lo conocia, es una alternativa a express?

*Claude (Cowork). Fastify + TypeBox: un esquema da tipos, validación y OpenAPI.*

**Prompt 2:**

> adonisjs tambien estaria sobre el tablero? Se lo he visto usar a los profes durante el curso

*Descartado: un framework en el centro choca con un núcleo de tiempo real.*

**Prompt 3:**

> si, la tira tiene que ir como entidad, vamos a un supuesto, quitando de en medio temas de potencia, yo podria tener N tiras, cada una con un efecto que el efecto sea audio reactivo o sea simplemente ambiente deberia de poder modelarse ya sea simplemente ignorando la entrada o como dos implementaciones distintas

*Una sola interfaz `Effect` con `usesAudio` y `FrameContext`; el motor funciona sin audio.*

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Prompt 1:**

> me parece bien workspaces, porque necesitamos monorepo en realidad?

*Claude (Cowork). Monorepo justificado por la frontera motor/navegador, impuesta por la estructura.*

**Prompt 2:**

> asi de primeras quitaria los ficheros, no nos lo piden y nos comprometen, solo carpetas  y de dos niveles como mucho

*Árbol solo con carpetas y 2 niveles como máximo.*

**Prompt 3:**

> 1- ok
> 2-ok
> 3- me gusta la idea, pero no podemos poner algo mas generico como .agents o agents.md o algo asi?

*`AGENTS.md` (estándar) + `.claude/` (específico de la herramienta).*

### **2.4. Infraestructura y despliegue**

**Prompt 1:**

> Trabajo en el Proyecto Final del Máster AI4Devs (proyecto: Mood Table). Antes de nada lee, en este orden:
> 1. CLAUDE.md (raíz): bases de trabajo, criterios de LIDR y, sobre todo, la §8bis con el plan de esta sesión.
> 2. docs/idea-mood-table.md: ficha y registro de decisiones (§10, D1-D29).
> 3. readme.md: el entregable, con las secciones ya escritas.
> No uses docs/PLAN-entregables.md: está obsoleto.
>
> Respeta las 4 bases de trabajo del CLAUDE.md: propón pero no tomes la iniciativa sin consultarme, explícame siempre el porqué, trata los temas de uno en uno y sé crítico conmigo. No ejecutes ningún comando git. Los borradores van en docs/borradores/ y pasan al readme solo cuando yo los valido.
>
> Orden de hoy:
> 1. Actualizar los requisitos de entrega de LIDR (§8bis punto 1). Te paso el documento de definiciones actualizado [adjuntar o pegar]. Compáralo con la §4 del CLAUDE.md y dime qué ha cambiado y qué impacto tiene en lo que ya está escrito, antes de tocar nada.
> 2. Seguir con el readme: §2.4 (empezando por la decisión Fly.io o Render para la demo pública), §2.6, §1.3 y §1.4, en versión "diseño previsto".
> 3. §4, §5 y §6 siguen en espera de la respuesta de LIDR: no las toques.

*Claude (Cowork). La IA recomendó Fly.io por la CPU sostenida que necesita el bucle del motor.*

**Prompt 2:**

> Tengo una cuenta de AWS y además cierto conocimiento de la plataform. ¿No nos encaja? Esto de Fly.io me parece una elección bastante exótica

*Se pasa a EC2 `t4g` (arm64, como la Pi): mismo despliegue en la mesa y en la demo.*

**Prompt 3:**

> Si, vamos con AWS + EC2. Pero yo creo que de cara a enviar la demo podemos usar el que nos de amazon, no necesitamos que sea "bonito" de cara a enviarla. Si lo necesitamos enviar ya podemos hacer una redireccion desde moodtable.josebaalonso.tech. Esto nos ahorra infra y gestión de certificados no?

> vale, estas seguro de que aws no da https? Me sonaba que si, si es verificado entonces vamos con la solución via DNS, pero haría un CNAME para evitarme la IP estatica. Por otro lado mi proveedor de dominio es Spaceship

*Verificado con fuentes: sin HTTPS en el nombre de Amazon y el CNAME no evita la IP fija. Queda registro `A` a IP elástica + Caddy.*

### **2.5. Seguridad**

**Prompt 1:**

> Yo es que el punto de la autenticación hasta lo quitaba, es abrir la lata de seguridad que queda fuera del mvp

*Claude (Cowork). Seguridad por contexto: mesa sin autenticación por decisión, demo pública protegida.*

**Prompt 2:**

> Me gusta todo, pero quizás añadiría alguna auditoría mas, solo las dependencias me parece poco, existe algo gratuito tipo sonarqube o snyk?

*Se evalúan herramientas gratuitas con sus condiciones actuales.*

**Prompt 3:**

> sobre el tema del form me comentan esto por el chat de LIDR. Es algo que ha cambiado sobre la definición inicial? Porque si es así quizas tengo que proporcionarte el documento de definiciones actualizado. quiero decir, el proyecto en si no es un fork... simplemente para que lo tengamos en cuenta a la hora de generarlo. Pero en todo caso será publico asi que no nos condiciona esta decisión.
>
> En cuanto a lo que me comentan no lo veo claro porque parece que estás descartando snyk porque das por hecho SonarQube. Yo proponia mas un SonarQube o Snyk ¿cual nos interesa? ademas creo que ambos tienen analisis de dependencias con lo que dependabot no se si tiene sentido

*Comparación honesta: Sonar gratis no analiza dependencias → SonarQube Cloud + Dependabot.*

### **2.6. Tests**

**Prompt 1:**

> Bueno, lo que comentas del riesgo es un problema a futuro de la implementación, no compromete que existan los tests de e2e. Las capas me parecen correctas

*Claude (Cowork). Se validan las capas propuestas por la IA (unitarios con frames dorados, integración, E2E con Playwright, hardware manual) y se saca del readme un detalle de implementación del E2E que la IA había planteado como riesgo.*

---

### 3. Modelo de Datos

**Prompt 1:**

> yo crearia una tabla de effectos, porque ahora mismo son 3 pero seguro que acaban siendo mas, ademas cada efecto puede llevar un configuración base, de esquema no definido que podriamos añadir a esa tabla. como lo ves?

*Claude (Cowork). Tabla renombrada; la definición del efecto se queda en el código.*

**Prompt 2:**

> 1- ok
> 2-Meter una gestion de tiras web? no se si veo el tema del CRUD, solo la parte de Update, pero las tiras son una configuración mas estatica, no tiene sentido meterla como parte del control del instrumento. Existen si se configuran, pero no tienen sentido meter esa parte con un gestor si luego tienes que hacer todo el cableado, no?
>
> por otro lado, D27 es como estaba antes, ahora no vamos a usar hyperion ni GPIO ni nada por el estilo, eso está claro no?

*Las tiras existen porque están cableadas: sin CRUD.*

**Prompt 3:**

> vale, el ajuste sigo sin ver las ventajas del UI para unos parametros que se pueden leer de la doc del hardware y luego no van a mutar, yo lo dejaria en fichero de configuracion. Usaria solo la base de datos para el estado, lo deja muy ligero?

*Tiras en fichero de configuración; SQLite solo para el estado (2 tablas).*

---

### 4. Especificación de la API

*Se registrará con la Entrega 2.*

---

### 5. Historias de Usuario

#### 5.0 PRD (`docs/PRD.md`)

**Prompt 1:**

> No lo veo claro. Hasta donde yo se el PRD es un documento de negocio, donde se describe que es lo que quieres, su proposito y su valor. Luego existe otro documento de REQUIREMENTS donde se detalle los requerimientos y donde encajan los RF y el Gherkin. Pero yo lo veo como dos cosas distintas con dos enfoques distintos. Quiero que hagas un research en internet para ver si esto es cierto o no. No necesito como resultado un informe grande, pero si un resultado compacto con sus fuentes que lo sostengan

*Claude (Cowork, modelo `claude-opus-5-5`). La IA proponía un PRD con requisitos numerados y cifras, más cercano a un SRS. Tras un research con fuentes (Atlassian, Jama, OpenSpec), el PRD queda como fuente de verdad de alto nivel (qué y por qué); los requisitos y los GIVEN/WHEN/THEN pasan al backlog y a OpenSpec.*

**Prompt 2:**

> Si, estoy de acuerdo ya nos hemos embarcado, esto tendria que haber surgido durante la seleccion del producto. Vamos a ello, el objetivo primario entonces es educativo y de tener la propiedad

*Al redactar el problema, la IA buscó alternativas y encontró LedFx, que cubre casi todo el MVP. El PRD lo cita como referencia y declara por qué se construye: propiedad y aprendizaje. Lección: el análisis de alternativas debió hacerse al elegir la idea (ficha D33).*

**Prompt 3:**

> Opino lo contrario, que hagamos una publicación para que lo puedan probar es una exigencia de la entrega, no del producto, por tanto pertenece al README, no al PRD. Hay que tener en cuenta que este proyecto puede vivir mas allá de la entrega y el README en ese caso cambiará bastante pero el PRD no deberia

*La IA proponía al visitante de la demo como tercer usuario. Queda como criterio para todo el PRD: lo que exige la entrega va al README; el PRD describe el producto y debe sobrevivir al máster.*

#### 5.1 Arnés para las historias (Claude Code: `AGENTS.md`, MCP de Linear, skills y subagentes)

**Prompt 1:**

> A1
> B -> subagente
> C -> me parece buena la propuesta
>
> Entes de empezar me gustaría contrastar el protocolo de la skill con la doc del curso. La verdad es que me parece bastante alineada con el protocolo pero por hacer un doble check. Tienes acceso a los docs del Google Drive que han guiado esto?

*Claude Code (app de escritorio, `claude-opus-5-5`, con el conector de Google Drive). Un subagente de solo lectura contrastó el protocolo con los documentos 04.0-04.6 del módulo 4 y el 11.2 (BDD). Estaba alineado con 04.3; se añadieron las 4 categorías de poke-holes, la checklist de Gherkin de 11.2, el DoD por tipo (04.6) y el planning poker a ciegas (04.4). Se detectó una contradicción del curso (la skill `expand-issue` de 04.6 genera los criterios con IA; 04.3 los reserva al humano): se sigue 04.3.*

**Prompt 2:**

> 1. La estimación igual no tendría sentido sacarla a un skill aparte también? Lo veo como un procedimiento aislado. De hecho tiene sentido sacar 3 skills y hacer una especie de flujo? Me gusta como está planteado, pero pido aislarlo
> 2. ok las añadimos
> 3. ok
> 4. DoD por tipo es lo que tiene sentido
>
> 5- ok
>
> Por otro lado si que le metería talla de camiseta. La regla de no estimar me refería a fibonacci, planning poker. Una talla de camiseta hecha por IA me parece bien

*La IA había diseñado dos skills (crear y refinar) con la estimación dentro del refinamiento. Queda un flujo de tres skills, una por estado de Linear: `/create-story` (Backlog, con talla de camiseta de la IA para priorizar) → `/refine-story` (caso feliz humano + subagente `poke-holes`, Opus) → `/estimate-story` (planning poker a ciegas contra el subagente `estimator`, Sonnet; pasa a Todo). Separar la estimación de la redacción es lo que pide 04.2.*

**Prompt 3:**

> veo que has creado las skills directamente, has usado el skill creator? Deberiamos haberlo hecho así. Por otra parte las voy a querer en Inglés, de hecho el arnés entero irá en inglés. No lo migremos todo ahora pero lo que vamos creando de momento a Inglés

*La IA había escrito los `SKILL.md` a mano. Se rehicieron con la guía de la skill-creator (explicar el porqué en vez de MUST, *assets* con revelación progresiva) y en inglés, con el contenido de Linear en español. De esta ronda y las siguientes salen las convenciones del arnés en `AGENTS.md`: arnés en inglés; `docs/instructions/` = el qué y skills = el cómo; lo que solo usa una skill vive en su carpeta (el DoD y la plantilla de la historia, repartida por dueño de sección). Los evals de la skill-creator quedan pendientes; la optimización de la `description` no aplica (skills de invocación manual).*

#### 5.2 Historias de usuario

**Prompt 1:**

> vale, vamos a acotar esto. No es razonable descomponer todo el alcance asi de primeras. En realidad esto nunca ocurre asi en un flujo normal solo lo estamos haciendo para cumplir con la rubrica. Mi razonamiento es el siguiente. La entrega esta orientada a un proyecto en el que se van a invertir 30h, nuestra aspiración es mayor. Yo lo que veo sentido es descomponer solo la primera. De esta manera queda demostrado el conocimiento y la forma pero el resto de Hs se iran descomponiendo durante el desarrollo segun se vaya avanzando. ¿Como lo ves? ¿Hay algo que nos lo impida?

*Claude Code (app de escritorio, `claude-opus-5-5`, MCP de Linear). La IA proponía descomponer H1, H2 y H5 a fondo y H3-H4 por encima. Queda un backlog refinado justo a tiempo: solo se descompone H1 (`MOO-5`) en cuatro historias (spike `MOO-12`, `MOO-13`, `MOO-14`, `MOO-15`); el resto de épicas se refinan durante el desarrollo. Las tres historias del README salen todas de H1.*

**Prompt 2:**

> 1,2,3 y 4. Pero antes de pasar al siguiente paso me gustaría que vieramos porque el agente nos ha dado tantos casos que nos aplican. Son muchisimos. Creo que podríamos deducir como optimizar el subagente en base a eso

*En su primera ejecución (`MOO-13`), el subagente `poke-holes` (Opus) devolvió 14 huecos y solo la mitad servían como criterio (el resto eran diseño, dependencias o repetían los non-goals). Diagnóstico: el rango "10-15" empujaba a rellenar, las categorías invitaban a preguntas de diseño y leía la arquitectura del README. Se rehízo con un filtro de observabilidad ("¿lo notaría el maker o el DJ sin mirar el código?"), máximo 8 criterios + 3 notas con destino, y comprobación contra non-goals antes de devolver. Segunda medición (`MOO-14`, `MOO-15`): 8 candidatos, todos observables. Antes, el caso feliz había pasado a describirse en lenguaje natural y la IA lo traduce a Gherkin sin añadir comportamiento (cambio en `/refine-story`).*

Instrucciones de `poke-holes` antes y después ([commit `4f7738f`](https://github.com/7daysofrain/mood-table-v2/commit/4f7738fa24dc1971edbe0df85a35174a0b7e450e), `.claude/agents/poke-holes.md`):

> **Antes:** Between 10 and 15 candidates, grouped into four categories: Casos límite · Supuestos implícitos · Escenarios faltantes · Dependencias. […] If needed, `readme.md` §2-§3 (architecture and data model).

> **Después:** The one test every candidate must pass: **would the maker or the DJ notice it without looking at the code?** If not, it is not a criterion. […] Candidatos a criterio (up to 8) […] Fuera de criterio (up to 3), tagged with their destination. […] Do **not** read the architecture or the data model. […] Before returning, check every candidate against the happy path and the non-goals.

**Prompt 3:**

> 3- vale, el a, pero creo que es importante que suene porque si no en el simulador no vas a ver si el efecto está funcionando correctamente, creo que esto tiene que entrar en el MVP, tenemos que ver donde encaja. Si necesita un play, necesita un play
> 1- b
> 2- abrir el panel

*Al traducir el caso feliz de `MOO-14`, la IA señaló que "suena" era ambiguo (usar el fichero como fuente frente a oírlo). Oírlo no estaba en el PRD, pero sin audio no se puede juzgar E2 en el simulador. Entra en el MVP como historia nueva de H1 (`MOO-22`, sin refinar hasta después de la entrega); PRD actualizado (H1, E7) y ficha D36. El PRD pasa a ser documento vivo.*

---

### 6. Tickets de Trabajo

#### 6.0 Herramienta de gestión y flujo de trabajo (Linear, `docs/instructions/`)

**Prompt 1:**

> Si no tenemos capacidad de tipos (historia, tarea, subissue...etc) casi me lo descarta por muy buena integración que tenga. No puedo crear la jerarquía que me va a demandar la ejecución autónoma. Por otro lado Linear es lo que se ha mostrado durante las demos del curso y en la documentación. Jira descartado por overkill. Confirma lo de Github Issues + Projects. También mira en el drive el contenido del curso por si se menciona alguna alternativa interesante

*Claude (Cowork, modelo `claude-opus-5-5`, con Google Drive). La IA recomendaba GitHub Issues + Projects por visibilidad pública. Verificado: los tipos de issue solo existen en organizaciones (los sub-issues sí funcionan; la IA corrigió su primera afirmación). El módulo 4 del curso fija Linear y la pirámide PRD → Epic → Historia → Tarea. Decisión: Linear (ficha D35).*

**Prompt 2:**

> 1 -> a
> Antes de seguir, me está chirriando un poco de que cada proyecto sea una H. No hemos tocado el concepto de epica hasta ahora, ¿porque introducirlo? Nadie nos lo ha pedido. Para mi tiene mas sentido que haya un proyecto "Mood Table" y a partir de ahi construimos. ¿Se puede reorganizar asi? ¿Como quedaria?

*La IA había modelado cada épica como un proyecto de Linear. Se mantiene la pirámide del curso, pero en un único proyecto: épica = issue padre, historia = sub-issue, tarea = sub-sub-issue. Setup hecho con el conector MCP de Linear y el navegador integrado (estados con "Spec", etiquetas, parent auto-close, automatizaciones de PR, linkbacks públicos).*

**Prompt 3:**

> incluso te diria sub-issue -> PR, paso en task.md -> commit

*Se resuelve la duplicación de tareas entre Linear y el `tasks.md` de OpenSpec con una frontera objetiva: una tarea de Linear = una PR; un paso del `tasks.md` = un commit. Queda en `docs/instructions/workflow.md`, referenciado desde un índice en `CLAUDE.md`.*

#### 6.1 Tickets

**Prompt 1:**

> No, dejamos deliberadamente el ticket de la bd aparte. En nuestro caso el uso de BD es mas residual, tiene sentido que no haya de primeras. Ese requerimiento está pensado para aplicaciones mas de CRUD puro. Seria forzarlo mucho. Lo dejamos apuntado en el README pero seguimos haciendo solo el H1

*Claude Code (`claude-opus-5-5`). La IA proponía añadir una historia de H5 para tener un ticket de BD y avisó del riesgo: el mentor condicionó SQLite a que "README y ticket" documenten la persistencia. Decisión humana: sin ticket de BD, porque inventarlo en H1 sería forzar la plantilla (pensada para CRUD). El README lo explica y remite al modelo de datos (§3).*

*Revisión (24-sep, tarde): una auditoría de la entrega contra la plantilla y los documentos de LIDR cruzó el README con `AGENTS.md` y la ficha (condición del mentor: "README y ticket") y marcó la contradicción. Se revirtió la decisión, pero sin forzar H1: historia `MOO-25` en la épica H5 (en Backlog, sin refinar) y su tarea `MOO-26` (esquema, modelo TypeScript, puerto `StateStore`, adaptadores y tests de contrato) como Ticket 3. El ticket de energía (`MOO-20`) pasa a ticket adicional.*

**Prompt 2:**

> Creo que hay que hacer dos cosas diferentes importantes, una meter el layout que va a gobernar el dashboard y otra lo que se busca en si

*Motivo de la carta 13 en el planning poker de `MOO-13` frente al 8 del subagente `estimator` (Sonnet, a ciegas). La discrepancia destapó un trabajo que no estaba escrito: el layout del panel. Se saca a la futura épica de enablers (con el montaje del repo), la historia gana un non-goal y se reestima a 8. Antes, la escala pasó de 1-8 a 1-13 (13 = dividir) para ganar resolución, con el significado de cada carta en `linear.md` §4.*

**Prompt 3:**

> No podemos montar eso en el CI, sería una locura de tiempo invertido, es un test interesante, pero se queda como deuda técnica

*En `MOO-15` el subagente estimaba 5 contando montar el loopback de ALSA en CI para probar la tarjeta de sonido. Queda como deuda técnica explícita (`MOO-24`) y una excepción escrita al DoD: el retraso se verifica a mano en la mesa. Estimación final: 3.*

#### 6.2 Primer change de OpenSpec (`MOO-28`: monorepo, lint, tests y CI)

**Prompt 1:**

> /opsx:propose MOO-28

*Claude Code (`claude-opus-5-5`), primer recorrido completo de OpenSpec (propose → update → apply). La tarea pedía valorar `skip_specs` frente a una spec; la IA lo preguntó en vez de decidir y se eligió spec con escenarios (`module-boundaries`, `quality-gates`). Al comprobar que `MOO-31` estaba integrada, la IA vio que todo el change decía "PR a `main`" cuando las tareas van contra la rama de la entrega; se corrigió con `/opsx:update` antes de implementar. Al aplicar, los tests escritos en rojo antes de la regla (TDD) destaparon que `eslint-plugin-boundaries` dejaba pasar en silencio `panel → @moodtable/engine` (lo trata como externo); se cerró con `checkAllOrigins` (ficha D37). Resultado: CI con `lint`, `typecheck`, `test` y el quality gate de SonarQube, todas requeridas por un ruleset de GitHub; un commit que rompía la frontera núcleo → adaptadores dejó `lint` en rojo y la PR bloqueada.*

**Prompt 2:**

> No, creo que sería "todo" hasta que hagamos un commit con el "spec". Para mi una tarea en el estado "spec" es una tarea que ya tiene los specs listos y comiteado y que podriía ser ejecutado por ejemplo por un agente autónomo porque ya no necesita gates humanos. Sin embargo aqui estamos todavia en fase de definicion y al no haber nada en el repo que otra persona pueda ver es mas un "todo"

*La IA proponía mover la tarea a "Spec" al empezar a definirla. Ajuste humano: "Spec" significa "change revisado, commiteado y subido, ejecutable sin más puertas humanas"; mientras se define, "Todo". El commit del change pasa a ser la aprobación (`workflow.md` §4, `linear.md` §2).*

#### 6.3 Librería de UI y layout del panel (`MOO-29`)

**Prompt 1:**

> /opsx:explore quiero afrontar la tarea M00-27 pero antes de empezarla creo que deberiamos de buscar una libreria de UI e instalarla. Necesito que investigues las librerias que hay y cual crees que se adaptarái mejor al proyecto

*Claude Code (`claude-opus-5-5`) en modo explore. Antes de comparar, la IA corrigió el punto de partida: `MOO-27` es la épica de enablers y la tarea es `MOO-29`. Además, instalar la librería en una PR propia dejaría una dependencia sin uso, así que la decisión iría al `design.md` del change de `MOO-29`. Al leer la tarea vio que "el build servido por el motor" mezclaba dos áreas y duplicaba `MOO-17`, que ya lo incluía. Se quitó de `MOO-29` (opción C1) en vez de crear una tarea nueva, que habría dejado tres sitios prometiendo lo mismo.*

**Prompt 2:**

> Quiero primero distinguir 3 tipos de librerias que vamos a utilizar:
> 1- Librería de UI. Para componentes UI
> 2- Libreria de layout, que nos permita tener un grid y manejar los layouts de la página
> 3- Librería de canvas, que nos facilite manejar <canvas> para las visualizaciones
>
> Empezemos con la de UI y luego vamos con las siguientes. Tengo las siguientes candidatas, quiero que bajo los criterios que necesita esta aplicación me hagas una comparativa y una recomendación:
> https://react-aria.adobe.com/
> https://mui.com/material-ui/all-components/
> https://ui.shadcn.com/
> https://mantine.dev/
> https://chakra-ui.com/

*La IA sacó siete criterios de los documentos (controles que genera el esquema, slider fluido de E1, propiedad del código de D33, sin internet, táctil futuro, afinidad con agentes, encaje con el repo) y descartó MUI y Chakra por usar Emotion en tiempo de ejecución. Recomendó shadcn/ui; el usuario eligió **Mantine 9** por velocidad y por traer el selector de color (D40). Con Mantine, la IA argumentó que una librería de layout aparte sobraba (`AppShell` y `SimpleGrid`) y que para el visor bastaba Canvas 2D nativo.*

**Prompt 3:**

> nada, posponemos esta decision porque no está relacionada

*Ajuste humano: la librería de canvas no se decide en este change, porque el visor lo dibuja `MOO-18` (change de `MOO-13`). El change quedó solo con la librería de UI, el layout y el tema oscuro. Al implementar, la spec se escribió primero como tests en rojo (zonas localizables por su nombre accesible) y una previsualización en el navegador integrado llevó a un ajuste más: que las columnas ocupen el alto que queda de la ventana.*

#### 6.4 Puertas de la PR e integración en `main` (`MOO-42`)

**Prompt 1:**

> /opsx:propose MOO-42 Para la sesión nueva, la rama es 7daysofrain/moo-42-integrar-las-tareas-en-main-y-endurecer-las-puertas-de-la-pr.

*Claude Code (`claude-opus-5-5`). Antes de escribir el change, la IA comprobó dos premisas de la tarea. La primera: `main` aún no tenía la E2 (ni las specs), así que el change no podía salir de ahí. El usuario prefirió integrar antes la entrega en `main` (PR #11). La segunda: la documentación de SonarQube Cloud confirmó que los* quality gates *propios son de pago. Por eso el gate con «New issues > 0» que pedía la tarea se convirtió en un job de la CI (`sonar-issues`), y el change pasó a llevar `design.md`.*

**Prompt 2:**

> hay una cosa que no veo claro. ¿Estamos usando openspec? Es que parece que se está ejecutando directamente lo que pone en linear

*La IA separó lo que eran pasos previos de la tarea (la PR de la entrega a `main`, la rama y el estado en Linear) del change, que aún no se había escrito, y explicó dónde se apartaba del ticket. La spec se escribió con los criterios de la tarea como traza; el criterio «el quality gate está en rojo» quedó como «la comprobación de incidencias está en rojo», marcado en la revisión.*

**Prompt 3:**

> acuerdate de poner la task in progress al empezar

*Ajuste humano: la IA había empezado a implementar sin abrir la PR en borrador, que es lo que pasa la tarea a* In Progress *(`workflow.md` §4.3). Al abrirla, la propia comprobación nueva falló con 3 incidencias de su código: dos inyecciones en el log, que eran reales y se corrigieron, y un `await` dentro de un bucle de espera, que el usuario aceptó en Sonar con el motivo. Fue la primera prueba en rojo y en verde de la puerta.*

#### 6.5 Regla qué/cómo en `workflow.md` y *chores* sin change (`MOO-38`)

**Prompt 1:**

> /opsx:propose MOO-38

*Claude Code (`claude-opus-5-5`). Antes de crear el change, la IA vio tres cosas:*
- *§4.1 repetía paso a paso las skills `/create-story`, `/refine-story` y `/estimate-story`;*
- *`/refine-story` cargaba §4 como contexto, así que la referencia era circular;*
- *la tarea no cambiaba ningún comportamiento observable, así que un delta de spec sería artificial.*

*Le dio a elegir al usuario entre un change con `skip_specs`, ningún change o una spec nueva. El usuario eligió **ningún change**, con el alcance limitado a §4.1. §4.4 también es «cómo», pero ninguna skill lo recoge, así que queda para otra tarea.*

**Prompt 2:**

> ok, prepara un plan y escribelo en Linear antes de ejecutarlo

*Sin change, la descripción de la tarea en Linear pasó a ser la fuente de verdad del plan: diagnóstico, decisiones y pasos, cada uno con su verificación. La IA dejó abierta una pregunta: ¿hacía falta una regla que dijera cuándo una tarea no lleva change? Sin ella, la excepción parecería un salto en la cadena.*

**Prompt 3:**

> si, añadiria la regla, de hecho la podemos expandir a cosas de chore también que no son funcionales y son pequeñas? como la que hemos hecho de pnpm recientemente?

*Ajuste de la IA a la propuesta: «pequeña» y «no funcional» no sirven como criterio. La propia `MOO-32` tiene efecto observable: la instalación falla con versiones demasiado nuevas. La regla que quedó en `workflow.md` §6 es esta:*
- *una `Chore` no lleva change si no añade ni cambia ningún requisito de `openspec/specs/`;*
- *si hay duda, lleva change;*
- *un `Refactor` lleva change siempre.*

#### 6.6 Evals de las skills de historias con skill-creator (`MOO-37`)

**Prompt 1:**

> Riesgo 1: En realidad la integración MCP real sobre linear está mas que probada. La hemos venido usando mucho. Asi que usemos Fixtures
> Riesgo 2:  Ok, los evals a lo que lleguen
>
> No sería necesario también reescribir las skills usando el skill-creator? Me suena que impone un formato y unas reglas que serían interesantes

*Ajuste de la IA: primero las evals y después los cambios, para poder medirlos. El validador de skill-creator rechaza `disable-model-invocation`, pero esa clave es la que impide que el modelo escriba en Linear por su cuenta. Por eso no se tocó y quedó documentada como un falso positivo.*

#### 6.7 Arreglo del hook `validate-ac` (`MOO-44`)

**Prompt 1:**

> vamos con la tarea MOO-44

*Claude Code (`claude-opus-5-5`, 12-oct). Los cuatro fallos los habían encontrado las evals de `MOO-37`: al pasar el validador por los fixtures y, uno de ellos, el grader. La IA sacó las palabras clave en español de `gherkin-languages.json` de Cucumber y, antes de escribir código, planteó tres decisiones con su recomendación. El humano aceptó las tres:*
- *cómo repartir los commits: un par rojo/verde por fallo;*
- *qué sinónimos dejar fuera: `Ejemplo:` y `*` chocarían con notas y viñetas de Markdown;*
- *qué exigir a un esquema: una tabla de ejemplos con filas.*

*Para no copiar descripciones, los tests leen las de `MOO-14` y `MOO-22` de los fixtures de las evals. La prueba de punta a punta con el hook real sobre `MOO-13` y `MOO-15`: en `main` bloquea y en la rama deja pasar.*

**Prompt 2:**

> 1. ok
> 2. vale
> 3. ejecuta

*Respuesta a tres cierres que propuso la IA: actualizar `linear.md` §8, registrar esta entrada y volver a pasar las evals de `refine-story`. En el punto 3 no relanzó los subagentes: volvió a calificar con el validador nuevo las salidas ya guardadas. Con la skill, todo pasa; sin ella, falla por una segunda acción tras el `Cuando`. Es el mismo defecto que el grader había anotado a mano en la aserción del When único, y que antes quedaba tapado por el «no tiene ningún Scenario».*

#### 6.8 INVEST rápido en `/refine-story` y poke-holes con las palabras del usuario (`MOO-46`)

**Prompt 1:**

> vamos con la MOO-46

*Claude Code (`claude-opus-5-5`, 12-oct). Los dos fallos venían de la línea base de `MOO-37`. Antes de tocar la skill, la IA vio que «antes de poke-holes» admitía tres sitios para el INVEST rápido y los planteó con su coste: tras el caso feliz y antes de traducirlo, tras validar la traducción (la lectura literal del ticket) o al cargar el contexto, antes de pedir el caso feliz. El humano eligió el primero, para no validar una traducción de una historia que se va a dividir, y aceptó también una aserción nueva en la eval de `MOO-22` que comprueba que el paso se ejecuta cuando la historia pasa.*

*Resultado de la iteración 2 (skill-creator, `new_skill` frente a `old_skill`, tres ejecuciones por caso): 100 % frente a 87 %.*
- *`MOO-22`: 19/19 frente a 17/19 en las tres. La versión antigua pasó la traducción GWT a poke-holes en las tres ejecuciones, e incluso la etiquetó como «escrito por el usuario».*
- *`MOO-901`: 8/8 frente a 3, 7 y 7 sobre 8. La versión nueva propone dividir sin traducir, sin lanzar poke-holes y sin escribir nada.*
- *El caso de pasos de interfaz: 6/6 en las dos, sin regresión.*

*Ajustes durante la medición:*
- *Dos ejecuciones se quedaron sin poke-holes por el límite de subagentes concurrentes. Pararon sin inventar candidatos y se repitieron.*
- *Con la respuesta guionizada nueva («De acuerdo, la divido»), dos ejecuciones antiguas también se pararon antes de poke-holes, pero después de traducir. Por eso la aserción que discrimina es la de proponer la división antes de traducir.*

**Prompt 2:**

> copilot ya ha revisado

*Copilot encontró un hueco en la regla nueva: si el usuario corrige su caso feliz al validar la traducción, poke-holes recibía solo la primera respuesta y podía reabrir huecos ya cerrados. La IA lo comprobó contra la skill antes de darlo por bueno. El arreglo del texto no tenía dudas: la respuesta más las correcciones, siempre con las palabras del usuario. Para medirlo, la IA ofreció tres opciones (solo el texto, ampliar la eval de `MOO-22` o un caso nuevo y corto) y el humano eligió el caso nuevo.*

*En el caso nuevo, el usuario corrige su caso feliz y el guion se acaba tras lanzar poke-holes. Iteración 3: 6/6 en las tres ejecuciones nuevas frente a 5/6 en las tres de la versión anterior de la PR. Las tres anteriores incorporaron la corrección a la traducción, pero a poke-holes le pasaron solo la primera respuesta.*

#### 6.9 El spike de rendimiento pasa a bloquear el audio (`MOO-47`)

**Prompt 1:**

> Ahora mismo todavia no he podido arreglar el hardware, igual podriamos empezar por la MOO-13 que puede correr solo con codigo en mi ordenador?

*Claude Code (`claude-opus-5-5`, 14-oct). Al pedir empezar la H1, la IA había señalado el spike `MOO-12` como primera historia, porque D13 lo ponía antes de la spec del motor. Ante la propuesta del humano no dijo que sí sin más: explicó el riesgo (si TypeScript no llega en la Pi, se rehacen `MOO-16` y `MOO-17`) y por qué es bajo (la respiración apenas gasta CPU; el coste está en la FFT de `MOO-14`). Propuso mover el bloqueo al audio en vez de quitarlo, y dio dos formas de registrar la decisión: una chore aparte o el `design.md` del change.*

**Prompt 2:**

> Si, hacemos el cambio de bloqueo y vamos por opción a

*Opción a: chore aparte (`MOO-47`), porque la ficha es la fuente de verdad de las decisiones y una PR no mezcla dos tareas. Al buscar referencias, la IA vio que la decisión también contradecía el supuesto A1 del PRD y tres frases del README, y las corrigió en la misma chore. D13 queda tachada con fecha (como D11), y el porqué y lo descartado van en D42.*

**Prompt 3:**

> Mira la PR que tenemos revision de copilot

*Copilot encontró dos frases de la ficha que seguían poniendo el spike antes del motor: la tabla de riesgos (§6) y los primeros pasos (§14). La comprobación de la IA buscaba con `grep` los identificadores (`MOO-12`, `D13`) y la frase literal del PRD, y no pilló las mismas ideas dichas con otras palabras. La IA lo verificó contra la ficha, lo corrigió con un commit, contestó en el hilo con ese commit y lo resolvió. Lección: cuando cambia una decisión, hay que buscar el concepto («spike», «spec del motor»), no solo los identificadores.*

#### 6.10 Los E2E con Playwright y su puerta en la CI (`MOO-49`)

**Prompt 1:**

> analiza MOO-49 a ver si necesitamos openspec o lo abordamos directamente

*Claude Code (`claude-opus-5-5`, 15-oct). La tarea es una `Chore` y el ticket ya decía que llevaba change, pero la IA no se fio de eso y lo comprobó contra la regla de `workflow.md` §6, que mira si se tocan requisitos y no el tamaño. Vio que cambiaban cuatro requisitos de `quality-gates`, y uno no lo citaba el ticket: «Un único runner de tests», que Playwright contradice. Lo planteó como decisión antes del `/opsx:propose`, junto con la de la cobertura, con su recomendación y su porqué.*

**Prompt 2:**

> 1- ¿Cual seria el segundo runnner?
> 2- No, ahi solo metemos unitarios
> 3- Si, claro, sin problema

*La IA explicó que el segundo runner es Playwright Test y por qué no usar Playwright como librería dentro de Vitest: se pierden el servidor, el aislamiento por test y las trazas. También recordó que README §2.6 ya los separaba así. Sobre la cobertura, no dio por buena la respuesta: los tests de integración también corren en Vitest y entran en el mismo informe. Preguntó si «solo unitarios» quería decir eso, y el humano lo aclaró: unitarios más integración, sin los E2E.*

*Ajustes durante el change y la implementación:*
- *Al escribir la verificación en GitHub, la IA vio su propio fallo: quitar una zona del panel también rompe `PanelLayout.test.tsx`, así que no aislaba la puerta nueva. La PR de prueba rompe `main.tsx`, que solo ve el E2E.*
- *La última versión de Playwright (1.64.1) tenía menos de un día y no cumplía `minimumReleaseAge`: se usó la 1.64.0.*
- *Un paquete TypeScript sin ningún `.ts` no compila (TS18003). El `tsconfig` de `e2e/` pasó del paso 1.1 al 1.2, para que cada commit quedara en verde, y se dejó escrito en `tasks.md`.*
- *ESLint analizaba el informe HTML de Playwright (3.719 errores en local): se añadió a sus ignorados.*

#### 6.11 El change de la HU1: el motor, el visor y la tira respirando (`MOO-13`)

**Prompt 1:**

> Y no tendría sentido que el visor respresente a una sola tira, que vaya con su cliente de websocket y que si hay varios visores sean varios clientes? Se que no es muy optimo, pero al final es visor de desarrollo y no creo que nunca haya mas de 2 o 3 tiras representadas. De esta manera se podrian incluso combinar visores "software" y "hardware" no? Este planteamiento cuadra?

*Claude Code (`claude-opus-5-5`, 14-oct), `/opsx:explore` de la historia tarea a tarea (`MOO-16`, `17` y `18`). La IA proponía un puerto de salida que recibiera todas las tiras de un pulso en un solo mensaje. El humano propuso una salida por tira. La IA le dio la razón en el puerto: el desfase de un frame entre tiras no se ve, y así una tira puede combinar salidas. Pero separó lo que la idea mezclaba: un WebSocket por tira es otra decisión, y se mantuvo una conexión por navegador. Quedó como D43.*

**Prompt 2:**

> No entiendo la premisa, la ruta debería ser,  relativamente la misma

*La IA proponía pasar la ruta del fichero de configuración siempre como argumento, porque el README la ponía en un sitio en el portátil y en otro en la Pi. Explicó de dónde venía esa premisa (`/etc`, por convención de Linux) y aceptó la propuesta del humano: una ruta fija dentro del repo, ignorada por git. El humano le cambió el nombre a `config/local.json`. Quedó como D44, que corrige D31.*

**Prompt 3:**

> esto es de importancia muy relativa, la demo está orientada a la evaluación por parte de los profesores, el uso real será siempre en red local, tiene sentido poner cotramedidas aqui? me parece sobrearquitectar

*La IA proponía saltarse frames para un navegador que no los recibe. Le dio la razón al humano para la demo, pero no cedió del todo: puso un caso de la red local (un móvil bloqueado con el panel abierto) con cifras, unos 65 MB en 10 minutos en la mesa real. Con esos datos, el humano lo dejó como riesgo aceptado, escrito en el `design.md` con su arreglo de una línea por si aparece.*

*Ajustes durante el change y la implementación de `MOO-16`:*
- *Al revisar el change, el humano fijó una regla: una decisión (D#) nunca se borra ni se renumera, se tacha y se marca como obsoleta, para no dejar referencias rotas. Así se trató la D43 que proponía el change de `MOO-49`.*
- *De la exploración salieron dos tareas aparte en Linear: `MOO-48` (`docs/instructions/` como sitio de la arquitectura y las buenas prácticas) y `MOO-49` (los E2E con Playwright, que esta historia ya usa).*
- *Al implementar, `JSON.parse` no siempre decía dónde fallaba el JSON. La IA escribió un localizador que da la línea y la columna, con sus tests, en lugar de dejar el escenario a medias.*
- *El test de una respiración completa falló por un error del propio test: con el redondeo, el brillo llega a 255 antes del segundo 2. Se corrigió el test, no el efecto.*
- *La IA puso el esquema de la respiración en el motor y luego lo movió a `shared`, que es lo que dice README §2.3, en un commit aparte.*

#### 6.12 La HU1 de punta a punta: motor, visor y panel (`MOO-16`, `MOO-17` y `MOO-18`)

**Prompt 1:**

> /opsx:apply MOO-13

*Claude Code (`claude-opus-5-5`, 15-oct). La IA implementó el change tarea a tarea, una PR por tarea y un commit por paso, con los tests en rojo antes del código. Pidió aprobación antes de cada decisión que no estaba cerrada: D43, D44 y D45 en la ficha, y los valores de la respiración (#FFA957, unos 2700 K, y 5 % de brillo mínimo), que congelan los frames dorados. Para que cada commit en rojo compilara, los pasos de test declaran la firma del código y lanzan un error.*

**Prompt 2:**

> Run a local code review of the MOO-16 branch now as a stand-in, apply what holds up, and still request Copilot's review once the quota is back.

*Copilot se quedó sin cuota y no revisó ninguna de las tres PR, así que la IA las revisó en local con `/code-review` y verificó cada hallazgo antes de tocar nada. Aplicó lo que era un arreglo claro, cada uno con su test: el mensaje de una tira que no es un objeto, el BOM de Windows, el temporizador desalineado con el bucle o la IP de la red en el log. Lo que cambiaba el comportamiento lo dejó al humano. Este eligió rechazar campos desconocidos, limitar los fps a 60 y las tiras a 256, siempre primero en la spec con `/opsx:update` y luego en el código. El riesgo de que cualquier web pueda conectarse al WebSocket quedó apuntado para H2.*

**Prompt 3:**

> 1

*Al escribir los E2E, la IA vio que la tarea contradecía D44: «una configuración de test» frente a «el motor carga siempre `config/local.json`». Paró antes de escribir código y dio tres opciones con su recomendación. El humano eligió la primera: la variable `MOODTABLE_CONFIG`, solo para los tests. Quedó como un matiz de D44, sin borrarla, y como escenario (asumido) en la spec antes que en el código.*

*Ajustes durante la implementación:*
- *La IA no abrió la PR en borrador con el primer commit, como pide `workflow.md`. El humano preguntó para qué hacía falta la PR, la IA lo explicó y reconoció el fallo, y desde `MOO-17` la abrió con el primer commit.*
- *La IA contestó en inglés aunque la memoria del proyecto pide español; el humano lo corrigió.*
- *Otra sesión dejó un worktree en `.claude/worktrees/`, y ESLint lo analizaba desde la raíz (200 errores ajenos a la rama). La IA lo detectó y comprobó el código sin esa carpeta, sin tocar el worktree.*
- *Los E2E pasan 15 de 15 con `--repeat-each=3` antes de subirlos, porque la puerta no tiene reintentos.*

#### 6.13 Montaje del hardware: `HARDWARE_SETUP.md` (`MOO-34`)

**Prompt 1:**

> /opsx:propose M00-34

*Claude Code (`claude-opus-5-5`, 1-oct). Antes de crear nada, la IA señaló que una tarea solo de documentación no encaja en un change de OpenSpec (sus escenarios describen comportamiento del sistema, no lo que dice un documento) y que los datos del cableado no podía inventarlos: un error quema hardware. El humano eligió hacerlo sin OpenSpec y aportar él los datos. A partir de fotos del montaje, la IA identificó cada pieza (Pi 4, Light Box CH340, fuente Mean Well de 18 A, adaptador de 8 A, tarjeta C-Media) y descubrió que el montaje no estaba hecho: el documento pasó de describir un montaje a diseñarlo, con el humano revisando cada conexión.*

**Prompt 2:**

> I can give you ssh access to the raspberry, maybe we can create an instructions file for you to connect to it and run the required commands

*La IA no puede escribir contraseñas, así que guio al humano para darle acceso con clave SSH y un alias, con una regla pactada: comandos de solo lectura sin preguntar y cualquier cambio en la Pi con permiso (reiniciar Hyperion lo pidió). Desde la Pi encontró dos cosas que cambiaron el plan: el sistema era de 32 bits y Node 24 no tiene versión oficial para ARM de 32 bits (ahora `MOO-52`), y Hyperion, el software de la v1, sí escribía en el Light Box. Propuso no reinstalar la Pi hasta ver la tira encendida, para conservar un software conocido con el que separar fallos de hardware de fallos de código nuevo.*

**Prompt 3:**

> Tengo un par de Arduinos Uno por aqui, no valen?

*Tras dos semanas de diagnóstico guiado con un polímetro que el humano usaba por primera vez (medida a medida, una cosa cada vez), la IA localizó dos averías: los LEDs 1 y 2 muertos, que el humano reparó soldando paso a paso, y el Light Box con la línea de datos clavada en alto. El humano propuso sustituirlo por un Uno que tenía por casa; la IA cargó el sketch Adalight-FastLED desde el Mac con `arduino-cli` y la tira se encendió. Para contar los LEDs, la IA cambió el método del humano (bajar de 10 en 10 en Hyperion no podía funcionar: el sketch tenía 198) por un único frame con marcas cada 10 y cada 50: 173 LEDs en una foto. El cambio de controlador quedó como D46 en la ficha: D10 y D26 se tachan y apuntan a ella, sin borrarse.*

*Ajustes durante la tarea:*
- *La IA dio por bueno «apagada = sin corriente» y tuvo que corregirse: una WS2812B con corriente y sin datos válidos también se queda apagada. El humano detectó que había medido la línea de datos con la Pi apagada.*
- *El humano no aceptó el polímetro para identificar los dos cables rojos y siguió las fundas a mano; la IA lo aceptó y pidió confirmarlo antes de enchufar.*
- *Las marcas azules no se veían con poco brillo; la IA las cambió por blancas, que no dependen del orden de color, y comprobó el orden aparte.*
- *La IA contestó varias veces en inglés aunque la memoria pide español; el humano lo corrigió.*
- *La resistencia de 330 Ω en la línea de datos queda sin poner por decisión del humano, con el riesgo escrito en el documento.*

#### 6.14 La Pi con Raspberry Pi OS de 64 bits (`MOO-52`)

**Prompt 1:**

> /opsx:explore MOO-52,

*Claude Code (`claude-opus-5-5`, 16-oct). Antes de reinstalar, la IA miró la Pi por SSH, solo leyendo: el kernel ya era de 64 bits pero el sistema seguía siendo de 32 (`armhf`), así que había que reinstalar igualmente, y en la tarjeta había cosas que no están en ningún repo (Hyperion, la pantalla táctil de la v1 con su kiosk y el código de la v1). Propuso una microSD nueva y guardar la vieja: la reinstalación se puede deshacer y Hyperion sigue a mano como software conocido para diagnosticar la tira. Señaló también que una *chore* sin requisitos no lleva change de OpenSpec (`workflow.md` §6) y que el spike `MOO-12` estaba previsto en una Pi 3 B+ que no es la de la mesa.*

**Prompt 2:**

> si, vamos a acelerar que ya hemos perdido mucho tiempo con el cableado. Hacemos la prueba sobre la que tenemos conectactada. Veo bien tu propuesta. Si quieres apagala y le cambio la SSD

*El humano decidió medir el spike en la Pi 4 de la mesa en lugar de reinstalar también la 3 B+. Queda como D47, con D13 tachada y marcada como obsoleta, y con su coste escrito: la 3 B+ deja de estar verificada. La IA apagó la Pi por SSH, vio que el Mac mini no tiene lector de SD, instaló Raspberry Pi Imager con permiso y dio los valores de la personalización, con la clave SSH del Mac para poder entrar sin contraseña.*

**Prompt 3:**

> corrije a mano

*La Pi arrancaba pero rechazaba la clave. Leyendo la partición de arranque desde el Mac, la IA vio que en la tarjeta estaba la ruta `~/.ssh/id_ed25519.pub` como texto en lugar de la clave: su propia instrucción («escoge `~/.ssh/id_ed25519.pub`») daba pie a escribirla. Recomendó regrabar; el humano prefirió corregir la tarjeta a mano y la IA lo hizo (la clave real y un `instance-id` nuevo), pero la Pi no volvió a aplicar la configuración. En la regrabación, la IA vio por la huella SSH de la Pi, idéntica a la del primer arranque, que la tarjeta no se había llegado a escribir, y comprobó la siguiente grabación en el lector antes de arrancar. Con la Pi en marcha verificó `arm64` (Debian 13), la WiFi, SSH solo con clave, el Arduino y la tarjeta de sonido. Lo aprendido quedó en `HARDWARE_SETUP.md` §4.2.*

*Ajustes durante la tarea:*
- *El humano escribió en el chat la contraseña de la Pi, la de fábrica; la IA no la usó, como estaba pactado, y propuso cambiarla al regrabar.*
- *La exploración pasó a ejecución (apagar la Pi, instalar Imager) con permiso del humano en cada paso. Cuando el humano preguntó si ya estaban haciendo la tarea, la IA enumeró lo que faltaba del flujo: la rama, el estado en Linear y la PR.*
- *En la Pi nueva `sudo` pide contraseña, así que la IA no puede administrarla sola: queda por decidir quién instala Node 24.*

#### 6.15 El spike de rendimiento en la Pi: TypeScript sirve (`MOO-12`, `MOO-54` y `MOO-55`)

**Prompt 1:**

> aqui te voy a pedir ayuda porque no se definir un happy path para algo que es un spike de rendimiento. Me interesa mas un resultado. Es decir, el unico path seria ejecutar la prueba y sacar un resultado fiable y medible con el que poder tomar la decision.
>
> Vamos por el camino del propotipo desechable

*Claude Code (`claude-opus-5-5`, 17-oct), con `/refine-story`. La skill prohíbe dar un borrador del caso feliz, así que la IA no lo escribió: le explicó al humano que en un spike el comportamiento observable es el resultado, y le pidió que concretara tres palabras suyas: «fiable», «medible» y «decisión». De ahí salieron los 3 minutos por pasada, las 13 configuraciones y el documento de resultados. Antes, la IA había sacado a la luz una decisión que D42 dejaba para el refinamiento, prototipo o motor real, y el humano eligió el prototipo. El subagente `poke-holes`, que solo vio las palabras del humano, propuso 8 criterios; el humano los repasó uno a uno y se quedó con 4.*

**Prompt 2:**

> Interesa como criterio ¿Como ves percentil 80?

*La IA no le dio la razón: el p80 deja fuera el 20 % de frames más lentos, que es justo donde caen las pausas del recolector de basura de Node, lo que pone en duda D8. Propuso dos cifras (la mediana para el margen, un percentil alto para los tirones), y el humano eligió el p95. Cuando el humano quiso fijar el umbral «luego, según vayamos haciendo pruebas», la IA lo paró: un umbral que se elige después de ver los datos siempre da por buena la medición. Quedó un umbral en dos niveles: el objetivo (mediana < 8 ms y p95 < 16,6 ms) y un mínimo que reabre D8 (p95 < 33,3 ms, es decir, 30 fps).*

**Prompt 3:**

> Lo veo con muchas piezas para ser un prototipo que mide el rendimiento. Aqui la decisión es "mas facil de desarrollar" no facil de escalar ni bien escrito. Eres consciente de eso verad?

*El humano rechazó el primer plan de ejecución: siete ficheros con separación de responsabilidades, para un código que se iba a tirar. La IA lo rehízo en dos ficheros (`bench.ts` y `run.sh`) y mantuvo solo lo que protege la medición: el temporizador real del motor y una suma de control para que V8 no se salte el trabajo. Con el permiso del humano para seguir hasta el final («me voy a dormir un rato»), lo midió en la Pi: 0,46 ms de mediana y 0,51 ms de p95 en la peor configuración, sin frenado. Queda como D48: TypeScript se confirma con margen y `fft.js` queda validada.*

*Ajustes durante la tarea:*
- *Planning poker: humano 5 y estimador ciego 5, por motivos distintos (el humano pesaba el volumen del prototipo; el estimador, que no necesita calidad de producto).*
- *Un subagente revisó el documento de resultados contra los datos en crudo. Las cifras cuadraban, pero encontró 8 imprecisiones. La más seria: la IA entraba por SSH en la Pi cada minuto para ver si había terminado, y eso subía la frecuencia de la CPU durante la medición. No cambia el veredicto, y el documento lo dice.*
- *El humano quiso conservar el prototipo como referencia. La IA propuso borrarlo y dejar la referencia en el commit `9d0005a`: en `main` se habría roto en cuanto cambiara el `ticker.ts` que importa. El humano estuvo de acuerdo.*
- *Copilot no revisó la PR porque se había agotado la cuota. La revisión del subagente lo cubrió.*

#### 6.16 El change de la HU2: la tira reacciona a un fichero de audio (`MOO-14`)

**Prompt 1:**

> esto es pull porque el motor es el que determina el ritmo

*Claude Code (`claude-opus-5-5`, 17-oct), `/opsx:explore` de la historia, hilo a hilo. La IA comparaba dos formas del puerto `AudioSource`: *push*, la fuente empuja bloques a un búfer del núcleo (lo que decía el README), y *pull*, el bucle pide la ventana del instante del pulso. Recomendaba *pull* con una lista de razones, y el humano la resumió en una que la IA adoptó como justificación del design: la fuente nunca decide cuándo pasa algo. Quedó como D50, y el búfer circular pasa del núcleo al adaptador de la tarjeta de sonido.*

**Prompt 2:**

> pues yo creo que (a) porque al final esto solo se produce como error de configuración, no es algo que alguien quiera elegir y hacerlo como dices escondería el error

*La IA proponía que una tira con un efecto reactivo y sin fuente de audio arrancara apagada, con un aviso en el log, para tener una sola regla al arrancar y en caliente. El humano lo descartó: al arrancar solo puede ser un olvido. La IA reconoció el fallo de su argumento (mezclaba dos momentos distintos) y apuntó el caso al que esta regla no llega: con H5, la reconciliación puede restaurar un efecto reactivo en una instalación que ha quitado su fuente. Queda como nota para la spec de H5.*

**Prompt 3:**

> * no, hace falta guardar compatibilidad, porque meter restricciones en pleno desarrollo. Para mi effect es obligatorio y validado contra los efectos existentes
> * Si, en inglés
> * Si
> * ok
> * si, perfecto

*La IA proponía `effect` opcional, con la respiración por defecto, para que los ficheros de configuración existentes siguieran valiendo. El humano lo hizo obligatorio y validado. La IA explicó lo que arrastraba: el `config/local.json` de cada uno deja de arrancar (y dice qué falta), la spec `effects` pierde un requisito y el contexto técnico de `MOO-14` en Linear queda obsoleto. Quedó como D52, con el catálogo de efectos en `shared`.*

*Ajustes durante la exploración y la spec:*
- *Rutas relativas: la IA recomendaba resolverlas desde el fichero de configuración, como `tsconfig` o ESLint. El humano prefirió una sola regla para todo el repositorio, la raíz, también para `MOODTABLE_CONFIG`. Es un matiz de D44.*
- *Un WAV que no sirve: el motor no arranca y dice qué formato acepta, sin explicar cómo convertirlo, por decisión del humano.*
- *El humano pidió que la actualización de su `config/local.json` fuera un paso de cada tarea y no un aviso suelto: no produce commit, y la PR lo avisa.*

#### 6.17 La HU2 de punta a punta: fichero de audio, energía y panel (`MOO-19`, `MOO-20` y `MOO-21`)

**Prompt 1:**

> Lanza también un subagente de code review

*Claude Code (`claude-opus-5-5`, 17-19 oct), `/opsx:apply` de la historia, sección a sección y una PR por tarea. Copilot se había quedado sin cuota, así que el humano pidió una revisión con un subagente en cada PR. En `MOO-20` encontró algo que los tests no veían: el de «la caída no depende de los fps» pasaba aunque se quitara la conversión con `dt`, porque con el fichero de golpes la tira la apaga la puerta de silencio y no la caída. La IA lo verificó y escribió un test que falla sin la conversión, y añadió los tonos a 48 kHz, que el escenario del WAV estéreo no cubría.*

**Prompt 2:**

> Si, descargalo, pero no hace falta cortarlo, lo usamos tal cual

*El design preveía cortar un loop mono de 5 MB o menos. Antes de seguir, la IA midió la pista: estéreo, 93,8 s y 16,5 MB en un repo público, y una costura en la que calculó que la tira parpadearía. El humano eligió el estéreo tal cual, porque con `MOO-22` el panel lo hará sonar. Al probarlo con el bucle real, la IA vio que su cálculo era falso (los 35 ms de silencio del principio no llenan la ventana de 40 ms) y corrigió la decisión 9 antes de subirla.*

**Prompt 3:**

> si, queda claro, ya lo habiamos decidido, pensaba que era algo nuevo. No me pidas confirmación para escribir decisiones que ya hemos tomado

*El `tasks.md` decía «D49 y D51, si el usuario las aprueba», y la IA pidió aprobarlas otra vez al cerrar `MOO-20`. El humano no reconoció la D49 como suya y pidió contexto. Tras la explicación, fijó una regla de trabajo: las D# que solo registran lo decidido en la exploración se escriben sin preguntar, y solo se pregunta por lo nuevo. Quedó guardada en la memoria del agente.*

*Ajustes durante la implementación:*
- *Al leer el código de la v1, la IA encontró que su banco mel tenía las frecuencias un 6 % desplazadas y que *energía* da un destello al empezar a sonar. El humano corrigió lo primero y mantuvo lo segundo. Los escenarios de los tonos pasaron a durar dos segundos, con su commit de OpenSpec.*
- *SonarQube marcó plantillas anidadas, bucles con índice y un `Math.sqrt` que la propia revisión había propuesto en lugar de `Math.hypot`. Se corrigieron todas; en los bucles, el humano eligió `for…of` antes que aceptar la incidencia.*
- *Los golpes duran unos 90 ms por segundo, así que los E2E de la historia muestrean el visor y el vúmetro en cada frame de pantalla en lugar de con `expect.poll`.*

#### 6.18 El change de oír el fichero en el panel: refinamiento, estimación y spec (`MOO-22`)

**Prompt 1:**

> pero esto siempre va a ser así no? Es decir, el motor arranca y empieza a procesar el audio, el navegador cuando entre y se conecte normalmente será en un punto en el futuro, pero rara vez en el "0:00"

*Claude Code (`claude-opus-5-5`, 19-oct), `/refine-story` de la historia, candidato a candidato del poke-holes. La IA proponía un esquema del escenario con dos casos de «oye el punto por el que va el motor»: la primera vez que se oye y al volver tras dejar de oír. El humano vio que el primero no es un caso límite sino el normal, así que pasó al caso feliz («el motor lleva un rato reproduciendo el fichero») y solo quedó aparte *volver a oír*. Antes, su primera versión del caso feliz empezaba a sonar al abrir el panel; la IA explicó que los navegadores exigen un gesto, y de ahí sale el botón de oír y dejar de oír. En la misma sesión, el humano pidió que la recomendación fuera al principio de cada propuesta, para no tener que hacer scroll.*

**Prompt 2:**

> vale, yo no he tenido en cuenta las pruebas complicadas. aunque es cierto que la sincronía podría ser un problema en principio no deberia ser tanto, lo puedo dejar en 5

*`/estimate-story`: el humano sacó un 2 («un componente bastante aislado») y el subagente estimador, a ciegas, un 8: dos áreas y un mensaje nuevo en el protocolo, la sincronía como incógnita seria y E2E con audio real en Chromium sin pantalla. La IA puso las dos cartas lado a lado con los supuestos de cada una, sin elegir por él, y el humano reconoció el coste de las pruebas. Quedó un 5, con la condición de que bastara una resincronización simple, que la exploración tenía que comprobar.*

**Prompt 3:**

> Wen audio tiene un api mas moderno asi que no hay duda

*`/opsx:explore`, decisión a decisión con diagramas en ASCII. La IA recomendaba Web Audio frente a `<audio loop>` y el humano lo aceptó por ser más moderno. La IA no dio el motivo por bueno: las dos API son estándar, y lo que decide es la precisión (saltar a una muestra exacta, un bucle sin costura y conocer el retraso de salida), que es lo que piden los escenarios. El `design.md` lo justifica así.*

*Ajustes durante la exploración y la spec:*
- *Contra qué reloj sincronizar: la IA mostró que con el del motor la luz iría por detrás del sonido en la demo pública, por la latencia de la red, y recomendó sincronizar contra lo que muestra el visor. El humano lo eligió (D53).*
- *Cómo sabe el panel por dónde va el fichero: la IA veía dos formas, enviar los `fps` y que el panel lo calcule, o un mensaje con la posición. El humano eligió el mensaje: «fuente de verdad única en el protocolo».*
- *La deriva: entre saltar al pasar un umbral, ajustar la velocidad o programar cada vuelta, el humano eligió el salto por simplicidad, con la velocidad como plan B si el salto se oye.*
- *El cambio se aprobó con el commit del change en su PR, y la implementación de `MOO-56` empezó en una rama encima sin esperar a integrarla, por decisión del humano.*

---

### 7. Pull Requests

*Se registrará con la entrega final.*
