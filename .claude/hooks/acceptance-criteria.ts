/**
 * Validación del formato de los criterios de aceptación de una historia (MOO-36): la sección
 * `## Criterios de aceptación` de la plantilla de `refine-story`, con escenarios GIVEN/WHEN/THEN.
 * Solo mira la forma; el contenido lo revisan el poke-holes y el humano.
 */

const SECTION_HEADING = /^##\s+Criterios de aceptación\s*$/i;
const NEXT_SECTION = /^#{1,2}\s/;
const SCENARIO = /^Scenario:(.*)$/;
// La palabra clave va seguida de espacio o de fin de línea: `Given:` no es un paso. El texto se recorta
// después, para que la expresión no tenga que dar marcha atrás entre espacios.
const STEP = /^(Given|When|Then|And|But)(?:\s(.*))?$/;
const LIST_MARKER = /^[-*+]\s+/;
// Huecos de la plantilla: `<…>` en cualquier punto (`hasTemplateHole`), o un texto hecho solo de puntos
// suspensivos.
const ONLY_ELLIPSIS = /^[.…\s]*$/;
// Marca que deja `/create-story` (`assets/story.md`) hasta que `/refine-story` escribe los escenarios.
const PENDING_REFINEMENT = /^_Pendiente de refinar \(\/refine-story\)\._$/;

type Keyword = 'Given' | 'When' | 'Then';

const ORDER: readonly Keyword[] = ['Given', 'When', 'Then'];

interface Scenario {
  name: string;
  /** Último paso principal visto: marca en qué punto del orden Given → When → Then va el escenario. */
  last: Keyword | undefined;
  seen: Set<Keyword>;
}

/** Devuelve la sección de criterios (sin el título), o `undefined` si la descripción no la tiene. */
export function extractCriteriaSection(description: string): string[] | undefined {
  const lines = description.split(/\r?\n/);
  const start = lines.findIndex((line) => SECTION_HEADING.test(line.trim()));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => NEXT_SECTION.test(line.trim()));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Estado del recorrido de la sección: los errores acumulados y el escenario abierto. */
interface Walk {
  errors: string[];
  current: Scenario | undefined;
  scenarios: number;
}

/**
 * Valida los criterios de aceptación de una descripción de Linear. Devuelve los errores encontrados;
 * una lista vacía significa que es válida o que no tiene sección de criterios que validar.
 */
export function validateAcceptanceCriteria(description: string): string[] {
  const section = extractCriteriaSection(description);
  if (section === undefined) return [];
  // Historia sin refinar: la sección existe pero solo con la marca de pendiente, sin escenarios.
  if (isPendingRefinement(section)) return [];

  const walk: Walk = { errors: [], current: undefined, scenarios: 0 };
  for (const raw of section) {
    const line = raw.trim().replace(LIST_MARKER, '');
    const scenario = SCENARIO.exec(line);
    if (scenario) openScenario(walk, (scenario[1] ?? '').trim());
    else readStep(walk, line);
  }
  closeScenario(walk);

  if (walk.scenarios === 0) {
    walk.errors.unshift('La sección «Criterios de aceptación» no tiene ningún «Scenario:».');
  }
  return walk.errors;
}

function openScenario(walk: Walk, name: string): void {
  closeScenario(walk);
  walk.scenarios += 1;
  walk.current = { name: name || `#${walk.scenarios}`, last: undefined, seen: new Set() };
  if (isPlaceholder(name)) {
    walk.errors.push(`Escenario #${walk.scenarios}: el nombre está vacío o es un hueco de la plantilla.`);
  }
}

function closeScenario(walk: Walk): void {
  const current = walk.current;
  if (!current) return;
  const missing = ORDER.filter((keyword) => !current.seen.has(keyword));
  if (missing.length > 0) {
    walk.errors.push(`Escenario «${current.name}»: falta el paso ${missing.join(', ')}.`);
  }
}

function readStep(walk: Walk, line: string): void {
  const step = STEP.exec(line);
  if (!step) return; // Texto libre (notas, `(asumido)`, vallas de código): no es un paso.

  const keyword = step[1] as Keyword | 'And' | 'But';
  const text = (step[2] ?? '').trim();
  const current = walk.current;
  if (!current) {
    walk.errors.push(`Paso «${line}» fuera de un escenario: falta la línea «Scenario:» antes.`);
    return;
  }
  if (isPlaceholder(text)) {
    walk.errors.push(`Escenario «${current.name}»: el paso ${keyword} está vacío o es un hueco de la plantilla.`);
  }
  const orderError = checkOrder(current, keyword);
  if (orderError) walk.errors.push(`Escenario «${current.name}»: ${orderError}`);
}

function isPendingRefinement(section: string[]): boolean {
  const content = section.map((line) => line.trim()).filter(Boolean);
  return content.length === 1 && PENDING_REFINEMENT.test(content[0] ?? '');
}

function isPlaceholder(text: string): boolean {
  return ONLY_ELLIPSIS.test(text) || hasTemplateHole(text);
}

/** `<…>` en cualquier punto del texto, buscado sin expresión regular para que sea lineal. */
function hasTemplateHole(text: string): boolean {
  const open = text.indexOf('<');
  return open !== -1 && text.includes('>', open + 1);
}

/** Aplica un paso al escenario y devuelve el error de orden, si lo hay. Los que faltan los dice `close`. */
function checkOrder(scenario: Scenario, keyword: Keyword | 'And' | 'But'): string | undefined {
  if (keyword === 'And' || keyword === 'But') {
    return scenario.last ? undefined : `${keyword} no puede abrir el escenario: continúa un paso anterior.`;
  }
  if (scenario.seen.has(keyword)) {
    return `${keyword} repetido: usa And para continuarlo.`;
  }
  const previous = scenario.last;
  scenario.seen.add(keyword);
  scenario.last = keyword;
  if (previous && ORDER.indexOf(keyword) < ORDER.indexOf(previous)) {
    return `${keyword} fuera de orden: va antes que ${previous}.`;
  }
  return undefined;
}
