/** 0 -> '' (unknown), 45 -> '45 min', 60 -> '1h', 80 -> '1h 20min'. */
export function formatMinutes(totalMinutes: number) {
  const minutes = Math.round(totalMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}
