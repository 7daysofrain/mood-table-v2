/** PR de prueba de MOO-167: una incidencia de SonarQube a propósito (await dentro de un bucle). */
export async function enOrden(tareas: (() => Promise<void>)[]): Promise<void> {
  for (const tarea of tareas) {
    await tarea();
  }
}
