/**
 * La duración de una pista de audio como la enseña el panel: minutos y segundos, `m:ss`.
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
