import { describe, expect, it } from 'vitest';

import { findJsonError } from './json-error.ts';

describe('dónde falla un texto que no es JSON', () => {
  it.each([
    ['{"a": 1}', 'un objeto'],
    ['[1, -2.5e3, "x\\n\\u00e9", true, false, null, {}, []]', 'una lista con todo tipo de valores'],
    ['  {"a": {"b": [ ]}}  \n', 'espacios alrededor'],
  ])('no encuentra error en %s (%s)', (text) => {
    expect(() => {
      JSON.parse(text);
    }).not.toThrow();
    expect(findJsonError(text)).toBeUndefined();
  });

  it.each([
    ['{ "strips": [ }', 1, 15, 'una lista que se cierra con }'],
    ['{\n  "a": 1,\n  "b": 2,\n}', 4, 1, 'una coma de más al final'],
    ['{\n "a": 1\n "b": 2}', 3, 2, 'falta una coma'],
    ['{"a": tru}', 1, 7, 'una palabra mal escrita'],
    ['{"a": 1', 1, 8, 'el texto acaba antes de tiempo'],
    ['', 1, 1, 'un texto vacío'],
    ['{a: 1}', 1, 2, 'una clave sin comillas'],
    ['{"a" 1}', 1, 6, 'falta el signo de dos puntos'],
    ['{"a": 01}', 1, 8, 'un número con un cero delante'],
    ['{"a": "x\\q"}', 1, 9, 'un escape que no existe'],
    ['{"a": "\\u12"}', 1, 8, 'un escape unicode incompleto'],
    ['{"a": "\t"}', 1, 8, 'un tabulador dentro de un texto'],
    ['{"a": "abc', 1, 11, 'un texto sin cerrar'],
    ['[1, 2] 3', 1, 8, 'algo después del valor'],
    ['[1 2]', 1, 4, 'falta una coma en una lista'],
  ])('en %j encuentra el error en la línea %i, columna %i (%s)', (text, line, column) => {
    expect(() => {
      JSON.parse(text);
    }).toThrow();
    expect(findJsonError(text)).toEqual({ line, column });
  });

  it('si el anidamiento es tan profundo que agota la pila, no sabe dónde falla', () => {
    expect(findJsonError('['.repeat(100_000))).toBeUndefined();
  });
});
