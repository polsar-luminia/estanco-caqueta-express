export function formatCOP(value: number): string {
  return (
    "$" +
    Math.round(value).toLocaleString("es-CO", { maximumFractionDigits: 0 })
  );
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

// dd/MM/yyyy exacto (no "9 sep" como formatDate): lo pide el plan de pago con
// tarjeta para la franja de "vence pronto" de validity_ends_at. No se usa
// date-fns (no está instalado en este repo pese a CLAUDE.md workspace) —
// mismo patrón que formatDate/formatTime: Intl con timeZone America/Bogota,
// leyendo las partes en vez de armar el string a mano con getUTC*, que
// correría un día distinto al de Colombia (ver "columna date + VPS en
// Berlín" en MEMORY.md — la misma trampa aplica a cualquier fecha en UTC).
export function formatDateDDMMYYYY(dateStr: string): string {
  const date = new Date(dateStr);
  const partes = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Bogota",
  }).formatToParts(date);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}
