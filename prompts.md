> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Esperamos un máximo de 3 por sección, principalmente los de creación inicial o  los de corrección o adición de funcionalidades que consideres más relevantes.
Puedes añadir adicionalmente la conversación completa como link o archivo adjunto si así lo consideras


## Índice

0. [Flujo de trabajo con IA](#0-flujo-de-trabajo-con-ia)
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

**Skills, subagentes, rules y comandos personalizados:**

**Cómo se trabaja con la IA (método):**

**Ajustes humanos más relevantes (resumen):**

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

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

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

#### 5.1 Historias de usuario

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

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

**Prompt 2:**

**Prompt 3:**

---

### 7. Pull Requests

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**
