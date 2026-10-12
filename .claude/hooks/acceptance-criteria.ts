/**
 * Validación del formato de los criterios de aceptación de una historia (MOO-36): la sección
 * `## Criterios de aceptación` de la plantilla de `refine-story`, con escenarios GIVEN/WHEN/THEN.
 * Solo mira la forma; el contenido lo revisan el poke-holes y el humano.
 */

const SECTION_HEADING = /^##\s+Criterios de aceptación\s*$/i;
const NEXT_SECTION = /^#{1,2}\s/;
// Palabras clave de Gherkin en inglés y en español (`# language: es`, `gherkin-languages.json` de
// Cucumber). Se dejan fuera `Example:`/`Ejemplo:` como sinónimos de escenario, porque una nota que
// empiece así abriría uno, y `*` como paso, porque es una viñeta de Markdown.
const SCENARIO = /^(?:Scenario|Escenario):(.*)$/;
const SCENARIO_OUTLINE = /^(?:Scenario Outline|Scenario Template|Esquema del escenario):(.*)$/;
const EXAMPLES = /^(?:Examples|Ejemplos):/;
// La palabra clave va seguida de espacio o de fin de línea: `Given:` no es un paso. El texto se recorta
// después, para que la expresión no tenga que dar marcha atrás entre espacios.
const STEP = /^(Given|When|Then|And|But|Dado|Dada|Dados|Dadas|Cuando|Entonces|Y|E|Pero)(?:\s(.*))?$/;
const LIST_MARKER = /^[-*+]\s+/;
// Huecos de la plantilla: `<…>` en cualquier punto (`templateParams`), o un texto hecho solo de puntos
// suspensivos. En un esquema, `<…>` es un parámetro, y solo es hueco si no es columna de los ejemplos.
const ONLY_ELLIPSIS = /^[.…\s]*$/;
// Marca que deja `/create-story` (`assets/story.md`) hasta que `/refine-story` escribe los escenarios.
// La plantilla la escribe en cursiva con `_…_`, pero Linear la devuelve con `*…*`, y así llega al
// editar una historia sin refinar. La cursiva cierra con el mismo carácter con el que abre.
const PENDING_REFINEMENT = /^([_*])Pendiente de refinar \(\/refine-story\)\.\1$/;

type Keyword = 'Given' | 'When' | 'Then';
type StepKeyword = Keyword | 'And' | 'But';

const ORDER: readonly Keyword[] = ['Given', 'When', 'Then'];

/** Cada palabra clave de paso, en el nombre inglés con el que la nombran los errores. */
const STEP_KEYWORDS: Readonly<Record<string, StepKeyword>> = {
  Given: 'Given', Dado: 'Given', Dada: 'Given', Dados: 'Given', Dadas: 'Given',
  When: 'When', Cuando: 'When',
  Then: 'Then', Entonces: 'Then',
  And: 'And', Y: 'And', E: 'And',
  But: 'But', Pero: 'But',
};

interface Scenario {
  name: string;
  /** Último paso principal visto: marca en qué punto del orden Given → When → Then va el escenario. */
  last: Keyword | undefined;
  seen: Set<Keyword>;
  /** Solo en un esquema del escenario (Scenario Outline). */
  outline: Outline | undefined;
}

/** Lo que hace falta para comprobar, al cerrar un esquema, que sus parámetros salen de los ejemplos. */
interface Outline {
  /** Columnas de las cabeceras de sus tablas de ejemplos. */
  columns: Set<string>;
  /** Filas de datos de esas tablas. */
  rows: number;
  /**
   * Tabla de ejemplos abierta: tras `Examples:` la siguiente fila es la cabecera, y las que siguen sin
   * interrupción, filas. Cualquier otra línea la cierra: una tabla posterior es de un paso.
   */
  table: 'header' | 'rows' | undefined;
  /** Parámetros `<…>` del nombre y de cada paso, y dónde aparecen. */
  uses: { where: string; params: string[] }[];
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
  for (const raw of section) readLine(walk, raw.trim().replace(LIST_MARKER, ''));
  closeScenario(walk);

  if (walk.scenarios === 0) {
    walk.errors.unshift('La sección «Criterios de aceptación» no tiene ningún «Scenario:» ni «Escenario:».');
  }
  return walk.errors;
}

function readLine(walk: Walk, line: string): void {
  const current = walk.current?.outline;
  if (current && line && !line.startsWith('|')) current.table = undefined;
  const outline = SCENARIO_OUTLINE.exec(line);
  const scenario = outline ?? SCENARIO.exec(line);
  if (scenario) openScenario(walk, (scenario[1] ?? '').trim(), outline !== null);
  else if (EXAMPLES.test(line)) readExamples(walk);
  else if (line.startsWith('|')) readTableRow(walk, line);
  else readStep(walk, line);
}

function openScenario(walk: Walk, name: string, isOutline: boolean): void {
  closeScenario(walk);
  walk.scenarios += 1;
  const outline: Outline | undefined = isOutline
    ? { columns: new Set(), rows: 0, table: undefined, uses: [] }
    : undefined;
  walk.current = { name: name || `#${walk.scenarios}`, last: undefined, seen: new Set(), outline };
  if (isPlaceholder(walk.current, 'el nombre', name)) {
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
  if (current.outline) checkOutline(walk, current.name, current.outline);
}

/** Un esquema necesita ejemplos, y cada parámetro que usa tiene que ser una de sus columnas. */
function checkOutline(walk: Walk, name: string, outline: Outline): void {
  if (outline.rows === 0) {
    walk.errors.push(
      `Escenario «${name}»: el esquema necesita una tabla «Examples:» o «Ejemplos:» con cabecera y al menos una fila.`,
    );
    return;
  }
  for (const { where, params } of outline.uses) {
    for (const param of params.filter((p) => !outline.columns.has(p))) {
      walk.errors.push(`Escenario «${name}»: ${where} usa <${param}>, que no es una columna de los ejemplos.`);
    }
  }
}

function readExamples(walk: Walk): void {
  const current = walk.current;
  if (current?.outline) {
    current.outline.table = 'header';
    return;
  }
  const where = current ? `Escenario «${current.name}»: ` : '';
  walk.errors.push(`${where}solo un esquema («Scenario Outline:» o «Esquema del escenario:») lleva ejemplos.`);
}

/** Una fila de tabla solo cuenta en los ejemplos de un esquema; las tablas de datos de un paso se ignoran. */
function readTableRow(walk: Walk, line: string): void {
  const outline = walk.current?.outline;
  if (outline?.table === 'header') {
    for (const cell of tableCells(line)) outline.columns.add(cell);
    outline.table = 'rows';
  } else if (outline?.table === 'rows') {
    outline.rows += 1;
  }
}

/** Las celdas de una fila `| a | b |`, recortadas. */
function tableCells(line: string): string[] {
  const cells = line.split('|').map((cell) => cell.trim());
  return cells.slice(1, line.endsWith('|') ? -1 : undefined);
}

function readStep(walk: Walk, line: string): void {
  const step = STEP.exec(line);
  if (!step) return; // Texto libre (notas, `(asumido)`, vallas de código): no es un paso.

  const keyword = STEP_KEYWORDS[step[1] ?? ''];
  if (!keyword) return;
  const text = (step[2] ?? '').trim();
  const current = walk.current;
  if (!current) {
    walk.errors.push(`Paso «${line}» fuera de un escenario: falta la línea «Scenario:» o «Escenario:» antes.`);
    return;
  }
  if (isPlaceholder(current, `el paso ${keyword}`, text)) {
    walk.errors.push(`Escenario «${current.name}»: el paso ${keyword} está vacío o es un hueco de la plantilla.`);
  }
  const orderError = checkOrder(current, keyword);
  if (orderError) walk.errors.push(`Escenario «${current.name}»: ${orderError}`);
}

function isPendingRefinement(section: string[]): boolean {
  const content = section.map((line) => line.trim()).filter(Boolean);
  return content.length === 1 && PENDING_REFINEMENT.test(content[0] ?? '');
}

/**
 * Dice si un texto (`where`: el nombre o un paso) es un hueco de la plantilla. En un esquema, sus `<…>`
 * son parámetros: se apuntan para comprobarlos contra las columnas de los ejemplos al cerrarlo.
 */
function isPlaceholder(scenario: Scenario, where: string, text: string): boolean {
  if (ONLY_ELLIPSIS.test(text)) return true;
  const params = templateParams(text);
  if (!scenario.outline) return params.length > 0;
  if (params.length > 0) scenario.outline.uses.push({ where, params });
  return false;
}

/** Los `<…>` del texto, en orden, buscados sin expresión regular para que sea lineal. */
function templateParams(text: string): string[] {
  const params: string[] = [];
  let open = text.indexOf('<');
  while (open !== -1) {
    const close = text.indexOf('>', open + 1);
    if (close === -1) break;
    params.push(text.slice(open + 1, close));
    open = text.indexOf('<', close + 1);
  }
  return params;
}

/** Aplica un paso al escenario y devuelve el error de orden, si lo hay. Los que faltan los dice `close`. */
function checkOrder(scenario: Scenario, keyword: StepKeyword): string | undefined {
  if (keyword === 'And' || keyword === 'But') {
    if (!scenario.last) return `${keyword} no puede abrir el escenario: continúa un paso anterior.`;
    // Given y Then se pueden continuar; el When no: dos acciones son dos escenarios (refine-story).
    return scenario.last === 'When' ? `${keyword} tras When: un escenario solo tiene una acción.` : undefined;
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
