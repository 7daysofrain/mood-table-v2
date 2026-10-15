/**
 * Dónde falla un texto que no es JSON válido. `JSON.parse` no siempre lo dice (con un carácter
 * inesperado, V8 solo cita el texto), así que se recorre la gramática de JSON hasta el primer
 * carácter que no encaja. Solo se usa después de que `JSON.parse` haya fallado.
 */

export interface TextPosition {
  /** Empezando en 1, como en los editores. */
  line: number;
  column: number;
}

/** Posición del primer carácter que impide que `text` sea JSON, o `undefined` si es válido. */
export function findJsonError(text: string): TextPosition | undefined {
  const offset = new JsonScanner(text).firstErrorOffset();
  return offset === undefined ? undefined : toPosition(text, offset);
}

function toPosition(text: string, offset: number): TextPosition {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

/** Se lanza en el primer carácter que no encaja y corta el recorrido. */
class Invalid extends Error {
  readonly offset: number;

  constructor(offset: number) {
    super(`JSON no válido en la posición ${offset}`);
    this.offset = offset;
  }
}

class JsonScanner {
  private readonly text: string;
  private index = 0;

  constructor(text: string) {
    this.text = text;
  }

  firstErrorOffset(): number | undefined {
    try {
      this.value();
      this.whitespace();
      if (this.index < this.text.length) throw new Invalid(this.index);
      return undefined;
    } catch (error) {
      if (error instanceof Invalid) return error.offset;
      throw error;
    }
  }

  private value(): void {
    this.whitespace();
    const char = this.text[this.index];
    if (char === '{') this.object();
    else if (char === '[') this.array();
    else if (char === '"') this.string();
    else if (char === '-' || isDigit(char)) this.number();
    else if (!['true', 'false', 'null'].some((word) => this.literal(word))) {
      throw new Invalid(this.index);
    }
  }

  private object(): void {
    this.index++;
    this.whitespace();
    if (this.text[this.index] === '}') {
      this.index++;
      return;
    }
    for (;;) {
      this.whitespace();
      if (this.text[this.index] !== '"') throw new Invalid(this.index);
      this.string();
      this.whitespace();
      this.expect(':');
      this.value();
      this.whitespace();
      if (this.text[this.index] === '}') {
        this.index++;
        return;
      }
      this.expect(',');
    }
  }

  private array(): void {
    this.index++;
    this.whitespace();
    if (this.text[this.index] === ']') {
      this.index++;
      return;
    }
    for (;;) {
      this.value();
      this.whitespace();
      if (this.text[this.index] === ']') {
        this.index++;
        return;
      }
      this.expect(',');
    }
  }

  private string(): void {
    this.index++;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === '"') {
        this.index++;
        return;
      }
      if (char === '\\') {
        this.escape();
      } else if (char !== undefined && char < ' ') {
        throw new Invalid(this.index);
      } else {
        this.index++;
      }
    }
    throw new Invalid(this.index);
  }

  private escape(): void {
    const char = this.text[this.index + 1];
    if (char === 'u') {
      const hex = this.text.slice(this.index + 2, this.index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Invalid(this.index);
      this.index += 6;
    } else if (char !== undefined && String.raw`"\/bfnrt`.includes(char)) {
      this.index += 2;
    } else {
      throw new Invalid(this.index);
    }
  }

  private number(): void {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.text.slice(this.index));
    if (!match) throw new Invalid(this.index);
    this.index += match[0].length;
  }

  private literal(word: string): boolean {
    if (!this.text.startsWith(word, this.index)) return false;
    this.index += word.length;
    return true;
  }

  private expect(char: string): void {
    if (this.text[this.index] !== char) throw new Invalid(this.index);
    this.index++;
  }

  private whitespace(): void {
    while (' \t\n\r'.includes(this.text[this.index] ?? 'x')) this.index++;
  }
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}
