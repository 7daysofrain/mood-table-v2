<!--
Ficha de idea (plantilla docs/PLANTILLA-idea.md) + registro de decisiones.
Fuente viva de la idea: cualquier decisión nueva se anota aquí (§10) con su porqué.
-->

# 🎟️ Pura Belia · Zona de clientes

> **Pitch (1 frase):** Un **panel de cliente propio** para Pura Belia (plugins de audio) donde
> quien ha comprado un instrumento entra con su email, ve sus licencias, libera y renombra los
> dispositivos activados, gestiona sus emails y ejerce sus derechos RGPD — con Lemon Squeezy
> reducido a un sistema tercero detrás del back, invisible para el cliente.

**Estado:** 🟡 **Candidata** (tercera idea, la "conservadora"; se compara con Mood Table v2 y se
decide con el tutor) · **Fecha:** 10-sep-2026 · **Autor:** Joseba
**Origen:** necesidad real de Pura Belia (empresa de Joseba y un socio; primer producto, **Fragua**,
129 €). Hoy "Mi cuenta" redirige al portal genérico de Lemon Squeezy (ADR-0002 de la web), un
parche aceptable con pocos clientes pero que da mala impresión a quien acaba de pagar. La decisión
de no tener panel propio se tomó por rapidez y por el coste RGPD; si el máster paga la
construcción, la ecuación cambia.
**Filtros del post-mortem de Sutegi:** ✅ hay un sistema real que construir sin la IA (existiría
igual, con o sin agentes); ✅ hay código sustancioso que no es un bucle agéntico (alta idempotente
por webhook + reconciliación, capa anticorrupción sobre Lemon Squeezy, autenticación, auditoría,
export/borrado RGPD). Matiz honesto: es código de **integración**, no de algoritmo.

---

## 1. Problema y usuario

- **Problema:** el cliente que compra Fragua recibe la clave por email de Lemon Squeezy y, si
  cambia de ordenador, quiere liberar un dispositivo o darse de baja de un email, tiene que
  entrar en un portal ajeno con otra marca y otro dominio (magic link de Lemon Squeezy). Pura
  Belia no tiene relación directa con su cliente: no sabe quién es sin pasar por LS.
- **Usuario / cliente:** el músico/productor que ha comprado un instrumento de Pura Belia (usa y
  paga). Usuario secundario: Pura Belia (soporte: "¿cuántos dispositivos tiene activos este
  cliente?").
- **Por qué importa:** (a) primera impresión de marca tras el pago; (b) **ownership de la
  relación con el cliente**: el ADR-0001 ya da por hecha una migración de Lemon Squeezy a Stripe
  en 1-2 años; si la identidad la tiene LS, la migración obliga a todos los clientes a
  re-registrarse; si es de Pura Belia, es un cambio de adaptador en el back; (c) la lista de
  dispositivos es el motivo nº 1 de soporte en plugins de audio ("tengo un portátil nuevo").

## 2. Qué hace el MVP (flujo principal *end-to-end*)

Un cliente compra Fragua en el checkout de Lemon Squeezy → LS envía el webhook `order_created`
al **back** de Pura Belia → el back verifica la firma, registra el evento (idempotente) y **crea
la cuenta** vinculada al cliente y a la licencia de LS → el cliente recibe un **email de
bienvenida** de Pura Belia con el enlace para fijar su acceso → entra en `account.purabelia.com`
→ ve su licencia y los dispositivos activados (leídos en vivo de LS por el puerto) → **libera**
un dispositivo para activar en otro ordenador (el back llama a LS `deactivate`, anota auditoría)
→ ajusta sus preferencias de email (Brevo) → puede exportar sus datos o borrar la cuenta.

Back = API + webhooks + puerto LS/Brevo · Front = panel de cliente · BD = cuentas, vínculos a LS,
alias de dispositivos, preferencias, eventos y auditoría (**sin copiar** pedidos ni claves).

## 3. Historias de usuario

**Must-have (5):**
1. **Alta automática tras la compra.** Como cliente, al terminar el pago en LS recibo un email de
   Pura Belia con mi acceso, sin registrarme a mano. *(Webhook firmado + idempotencia +
   reconciliación por API; incluye el backfill único de los clientes que ya compraron antes de que
   exista el panel.)*
2. **Entrar en mi cuenta.** Como cliente, accedo con mi email (magic link o contraseña) y veo mi
   panel con la marca de Pura Belia. *(Identidad propia: la pieza que hace posible la migración
   LS → Stripe sin dolor.)*
3. **Mis licencias y dispositivos.** Como cliente, veo mis licencias (producto, estado, límite de
   activaciones) y los dispositivos activados, puedo **liberar** uno y ponerle un **nombre**.
   *(Flujo vertebral. El estado de activaciones sigue en LS, leído/escrito por el puerto; el alias
   es dato propio.)*
4. **Preferencias de email.** Como cliente, elijo qué comunicaciones recibo (novedades, avisos
   de versión) y el back lo sincroniza con las listas de Brevo. *(Segunda integración externa,
   mismo patrón de puerto.)*
5. **Mis datos y baja.** Como cliente, descargo lo que Pura Belia guarda de mí y puedo borrar la
   cuenta. *(No es opcional: al tener cuenta propia Pura Belia es responsable del tratamiento.
   Pocos alumnos lo hacen; se defiende solo.)*

**Should-have (1):**
- **Descargas por licencia:** instaladores completos de la versión actual (y anteriores) desde
  el panel, con URL firmada de corta vida. *(Arrastra mover ficheros de IONOS a un bucket y
  decidir qué pasa con los permalinks públicos ya "cocidos" en emails y manual: tercera
  integración, por eso no es must.)*

**Explícitamente fuera del MVP (visión):** servidor de licencias propio (hoy el plugin activa
contra LS vía `api.purabelia.com`, contrato congelado en ADR-0006), checkout/facturas/reembolsos
propios (LS es *merchant of record*), panel de administración para Pura Belia, multi-producto
(Portador), i18n. Ver §11.

## 4. Stack tentativo

- **Back:** TypeScript/Node (framework por decidir en la sesión de arquitectura; candidatos
  Fastify/Hono/NestJS). Arquitectura hexagonal: dominio (cuenta, licencia, dispositivo,
  preferencia, solicitud RGPD) + puertos `PaymentProvider` (LS hoy, Stripe mañana), `EmailLists`
  (Brevo), `Mailer` (transaccional), `Clock`. Endpoints: webhooks LS, API del panel (OpenAPI).
- **Front:** panel web (React o Astro SSR con islas; decidir en arquitectura). Diseño con
  `DESIGN.md` de la web (canvas negro, rampa teal de marca). **Cero llamadas a LS desde el
  navegador.**
- **BD:** PostgreSQL en **región UE** (Supabase/Neon en Frankfurt, o Postgres gestionado en el
  mismo host). Modelo mínimo: `users`, `auth_tokens`/`sessions`, `provider_links` (ids de
  cliente/licencia en LS, **no** la clave), `device_aliases`, `email_preferences`,
  `webhook_events` (idempotencia), `audit_log`, `gdpr_requests`.
- **Despliegue:** host con funciones/servidor y región UE (Netlify/Vercel/Fly/Railway; la web
  hoy va por SFTP a IONOS, que no sirve). Subdominio `account.purabelia.com`. Staging con LS en
  **modo test** + Brevo en lista de pruebas.
- **¿IA dentro del producto?** **No.** Es un panel de cliente; el eje 3 se cubre con el proceso,
  igual que en Mood Table. Se dice sin disfraz.

## 5. Uso de IA — *eje de nota* (1/3 de la evaluación)

- **Enfoque:** el mismo que Mood Table (*fábrica dirigida por specs con puertas humanas*), pero
  con un ingrediente que aquí pesa más: **seguridad y legalidad como puertas explícitas**.
  Auth, webhooks y RGPD son código donde un fallo cuesta dinero o una sanción; la IA se usa
  como *peer* para hacer "poke-holes" a cada spec (¿qué pasa si el webhook llega dos veces?
  ¿y si llega antes que la API tiene el pedido? ¿y si el email del pedido cambia?), y como
  revisora contra una checklist de seguridad (OWASP ASVS nivel 1) antes de cada PR.
- **En el proceso:** SDD con OpenSpec; PRD → backlog → spec → código; Cowork/Opus para
  decisiones, ADR revisado y documentos; Claude Code para implementación, tests y git.
  Candidatos a skills/subagentes: skill "nuevo puerto/adaptador" (interfaz + adaptador real +
  adaptador falso + test de contrato), subagente **simulador de Lemon Squeezy** (servidor falso
  con los mismos JSON, para tests de integración y E2E sin tocar la cuenta real), subagente de
  **revisión de seguridad**, skill "escenario RGPD" (export y borrado con evidencia).
- **Decisiones validadas por spike** (material de `prompts.md`): qué expone de verdad la API de
  LS (¿se puede listar licencias por cliente? ¿qué trae el webhook?), y qué permite Brevo por
  API para preferencias.
- **Ajustes humanos ya registrables:** la revisión razonada del ADR-0002 (Path A → Path B con
  guardarraíles), la corrección de Joseba "ownership del usuario es nuestro, LS es un tercero
  detrás del back" frente a la propuesta inicial de leer todo en vivo, el límite explícito
  "identidad sí, servidor de licencias no", y RGPD elevado a must-have.
- **En el producto:** no aplica.

## 6. Riesgos y puntos grises

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Webhooks como única fuente de verdad** | Alto (usuarios sin cuenta, duplicados) | Firma verificada, `webhook_events` idempotente, reconciliación por API bajo demanda, backfill inicial. Especificado con escenarios BDD. |
| **Alcance del ownership** (tentación de ser servidor de licencias) | Alto (toca el plugin y el contrato congelado de ADR-0006) | Regla escrita: identidad y cuenta propias; activaciones en LS vía puerto. |
| **Seguridad de la autenticación** (magic link/contraseña propios) | Alto si se hace mal | Decidir en arquitectura: implementación propia mínima y revisada (más lucimiento en eje 2, más responsabilidad) vs proveedor de auth en UE (menos código, menos riesgo). Hablar con el mentor. |
| **Dependencia de la API de LS** (límites, campos, modo test) | Medio | Spike inicial; simulador propio para tests; adaptador aislado (ADR-0001). |
| **Migración LS → Stripe** durante o tras el proyecto | Medio | Es justamente lo que el puerto protege; el modelo guarda ids de proveedor con `provider` explícito. |
| **RGPD**: Pura Belia pasa a responsable del tratamiento | Medio, permanente | Datos mínimos, región UE, export/borrado como funcionalidad, política de privacidad actualizada (tarea del socio, no del proyecto). |
| **Hosting/DNS del subdominio** en manos de la empresa | Medio (calendario del máster = calendario de la empresa) | Staging propio desde la E2; el subdominio real solo para la E3. |
| **Código "de integración"** frente a un evaluador que busque dominio rico | Medio | Compensar con calidad: hexagonal de verdad, tests de contrato por adaptador, E2E con simulador, seguridad documentada. |
| **Brevo**: que su API no permita lo que queremos por contacto | Bajo | Spike; si no, preferencias solo en BD y sincronía por lista. |

**Fuera de la evaluación — condiciones para el uso en producción.** El proyecto del máster se
cierra y se despliega por sí solo (URL pública propia, LS en modo test). Que además llegue a
`account.purabelia.com` con clientes reales depende de cosas que no puntúan: OK del socio a la
revisión del ADR-0002 (dado por casi seguro), aviso a Pascu, política de privacidad actualizada
y quién opera el panel después. El acceso técnico (cuenta LS, DNS, hosting, Brevo) lo tiene
Joseba: es su rol en la empresa. Se coordina en paralelo, sin fecha del máster encima.

## 7. Atractivo (orgullo / redes)

Un panel **en producción para una empresa real**, con marca, en `account.purabelia.com`, que
resuelve el caso de soporte más habitual de un plugin de audio. Demostrable en 2-3 minutos:
compra en modo test → llega el email → entro → libero un dispositivo → lo activo en otra máquina
→ exporto mis datos. Menos vistoso que una mesa que baila con la música, pero con una frase que
en LinkedIn pesa: "lo diseñé, lo construí con agentes bajo specs y está en producción".

---

## 8. Scorecard de comparación

| Criterio | Peso | Nota (1-5) | Comentario |
|---|:---:|:---:|---|
| Eje 1 · Idea y arquitectura | Alto | **4** | Decisiones de arquitectura reales y con motivo de negocio (ownership de identidad, capa anticorrupción ante la migración LS→Stripe, revisión razonada de un ADR). Pero el patrón "portal de cliente" es conocido. |
| Eje 2 · Calidad de código viable en plazo | Alto | **4** | Muy testeable (adaptadores falsos, simulador de LS, contratos, E2E del flujo compra→cuenta→liberar). Stack que Joseba domina. Menos algoritmo que Mood Table; la seguridad es una exigencia extra. |
| Eje 3 · Lucimiento del uso de IA | Alto | **4** | Mismo proceso que Mood Table más un ángulo propio: IA como *peer* de seguridad y RGPD (poke-holes, checklist, simulador fabricado). Sin IA en el producto. |
| "Completo, no extenso" (flujo E2E cerrable) | Alto | **4** | Un flujo claro y cinco historias, pero tres sistemas externos (LS, Brevo, email transaccional) y un backfill: más superficies que cerrar. |
| Factibilidad en fechas (25-sep / 23-oct / 11-nov) | Medio | **4** | Sin hardware, stack conocido, spikes baratos, acceso a todos los sistemas. Riesgo: tres proveedores externos que integrar y probar en dos meses. |
| Atractivo / orgullo / redes | Medio | **4** | Producto real en producción con marca; la demo es un panel, no un espectáculo. |
| Motivación y dominio conocido | Medio | **5** | Empresa propia, dolor propio, JS/Node/React. |
| Riesgo técnico (5 = bajo) | Medio | **4** | Webhooks, auth y proveedores externos: riesgos conocidos con mitigación estándar. |
| **TOTAL** (suma) | | **32/40** | |

**Veredicto rápido:** **Seguir como candidata sólida.** Perfil opuesto a Mood Table (36/40): menos
brillo de producto y menos dominio "de motor", pero **más utilidad real, menos riesgo técnico y
despliegue en producción de verdad**. La decisión no es cuál es "mejor", sino qué se quiere
optimizar: nota potencial y espectáculo (Mood Table, con riesgo de Pi/hardware) o seguridad de
entrega y valor para la empresa (Pura Belia, con riesgo técnico bajo y conocido). El uso en
producción real es un extra que no puntúa (ver nota de §6).

## 9. Preguntas para el mentor

- El proyecto es una pieza de un producto real de mi empresa: ¿se entrega en el fork de LIDR
  como repo propio (privado con acceso al TA) y luego se integra, o hay alguna pega por ser
  "de empresa"?
- ¿Cuenta como arquitectura (eje 1) la revisión formal de un ADR existente con guardarraíles,
  o se espera una arquitectura "desde cero"?
- Autenticación: ¿preferís ver una implementación propia (magic link, sesiones) revisada con
  criterios de seguridad, o un proveedor de auth en UE? ¿Qué luce más en el eje 2?
- Tests E2E contra un sistema externo: ¿vale un simulador propio de Lemon Squeezy (con los
  mismos JSON) o esperáis pruebas contra el modo test real?
- Sin IA en el producto: ¿algún problema si el eje 3 se cubre íntegramente con el proceso?

---

## 10. Decisiones tomadas (10-sep-2026) — con su porqué

| # | Decisión | Porqué |
|---|---|---|
| D1 | **Revisar el ADR-0002** (Path A → Path B) con dos guardarraíles heredados: proveedores en región UE y datos mínimos | El propio ADR preveía la revisión "si una zona de cuenta integrada se convierte en necesidad real". La necesidad existe (primera impresión, soporte de dispositivos) y el coste de construcción cae a cero con el máster. El OK del socio (casi seguro) afecta al uso en producción, no al proyecto. |
| D2 | **Ownership de la identidad es de Pura Belia**; LS es un tercero invocado desde el back | Corrección de Joseba a la propuesta inicial (leer todo en vivo sin cuenta propia). Motivo de peso: la migración LS→Stripe prevista en ADR-0001 pasa de "todos se re-registran" a "cambio de adaptador". |
| D3 | **Alta por webhook + reconciliación por API + backfill inicial** | Los webhooks llegan tarde, repetidos o desordenados; los clientes anteriores al panel no llegan por webhook. Idempotencia y reconciliación son parte del MVP, no un extra. |
| D4 | **Identidad sí, servidor de licencias no** | Las activaciones viven en LS y el plugin las consulta por `api.purabelia.com` con contrato congelado (ADR-0006). Sustituirlo toca el plugin de Pascu y rompe el plazo. El panel lee y libera vía puerto. |
| D5 | **No copiar claves ni pedidos**: guardar ids de proveedor (`provider`, `external_id`) | Minimización RGPD y coherencia con "LS sigue siendo el controlador de los datos de pago". Lo que es de Pura Belia (alias, preferencias, auditoría) sí se guarda. |
| D6 | **RGPD (export + borrado) como must-have** | Consecuencia legal de D1: al tener cuenta propia, Pura Belia es responsable del tratamiento. Además se defiende bien ante el tutor. |
| D7 | **Renombrar dispositivos entra en la historia 3** | Con BD propia el alias es una tabla trivial; no merece historia aparte. |
| D8 | **Descargas por licencia como único should-have** | Es la que más infraestructura nueva arrastra (bucket, URLs firmadas, permalinks ya publicados). |
| D9 | **"Transparente" con límite honesto**: checkout, facturas y reembolsos siguen en LS | LS es *merchant of record*; el panel hace invisible la gestión posterior a la compra, que es lo que el cliente usa el 99 % del tiempo. |
| D10 | **Sin IA en el producto** | Es un panel; meter IA sería la trampa de Sutegi al revés. El eje 3 se cubre con el proceso. |

## 11. Fuera del MVP (visión, por orden de deseo)

1. Descargas por licencia con URLs firmadas (should-have si hay tiempo).
2. Panel de administración para Pura Belia (buscar cliente, ver dispositivos, reenviar acceso).
3. Multi-producto (Portador) y multi-licencia por cuenta con bundles.
4. Migración del proveedor de pago (Stripe) como segundo adaptador: la prueba de fuego del puerto.
5. Servidor de licencias propio (sustituir la License API de LS), coordinado con el plugin.
6. i18n (ES/EN) alineado con la web.

## 12. Contexto del repo actual (`pura-belia-web`, leído 10-sep-2026)

Astro 7 estático desplegado por SFTP a IONOS, staging en Netlify con Basic Auth. Sin tests ni
linter. Decisiones vigentes que condicionan el proyecto: **ADR-0001** (Astro con intención
híbrida; aislar LS tras una capa de servidor; migración a Stripe esperada), **ADR-0002** (sin
cuentas ni BD; a revisar aquí), **ADR-0005** (email y captación en Brevo, listas como
segmentación), **ADR-0006** (servicio `fragua-activation` en AWS Lambda + KMS, `eu-central-1`,
contrato `POST /activate` congelado; sin BD, sin PII). `DESIGN.md` como sistema de diseño
(documental). El panel sería el **segundo deployable** del ecosistema tras el activation service
y reutiliza su regla: LS detrás de un puerto, región UE, sin PII en logs.

## 13. Primeros pasos técnicos (antes de la E2)

1. **Spike de la API de Lemon Squeezy en modo test:** crear pedido de prueba, capturar el
   webhook `order_created` (y `license_key_created`), comprobar cómo se llega de cliente →
   licencias → instancias, y qué devuelve `deactivate`. Resultado → §10 y `prompts.md`.
2. **Spike de Brevo:** qué permite la API por contacto (listas, atributos, doble opt-in).
3. **Decisión de auth y hosting** en la sesión de arquitectura (README §3), con las respuestas
   del mentor.
4. Con los dos spikes y la decisión, cerrar la primera spec OpenSpec: *alta por webhook* (escenarios de
   duplicado, desorden y backfill).
