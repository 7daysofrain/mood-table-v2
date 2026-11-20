/** PR de prueba de MOO-168: aplica las migraciones de la base de datos, de la más antigua a la última. */
export async function aplicarMigraciones(migraciones: (() => Promise<void>)[]): Promise<void> {
  // Cada migración parte del esquema que deja la anterior: tienen que ir una detrás de otra y nunca a
  // la vez, así que el `await` dentro del bucle es a propósito.
  for (const migracion of migraciones) {
    await migracion();
  }
}
