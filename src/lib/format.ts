const LOCALE = 'es-AR';
const CURRENCY = 'ARS';

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
});

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const monthFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
});

export function formatMoney(amount: number): string {
  return currencyFmt.format(amount);
}

/** Recibe una fecha ISO (YYYY-MM-DD) y la muestra legible. */
export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return dateFmt.format(d);
}

/** Recibe una clave de mes (YYYY-MM) y devuelve "junio de 2026". */
export function formatMonth(monthKey: string): string {
  const d = new Date(monthKey + '-01T00:00:00');
  const label = monthFmt.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Devuelve la clave de mes (YYYY-MM) de una fecha ISO. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Cantidad de días de un mes (clave YYYY-MM). */
export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year!, month!, 0).getDate();
}

/** Versión corta de un mes (YYYY-MM) para ejes: "jul 26". */
export function formatMonthShort(monthKey: string): string {
  const d = new Date(monthKey + '-01T00:00:00');
  const label = new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(d);
  return `${label.replace('.', '')} ${String(d.getFullYear()).slice(2)}`;
}

/** Importe compacto para ejes y chips: $1,2 M · $120 k · $850. */
export function formatMoneyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const trim = (n: number): string => {
    const rounded = Math.round(n * 10) / 10;
    return String(rounded).replace('.', ',');
  };
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)} k`;
  return `${sign}$${Math.round(abs)}`;
}

/** Desplaza una clave de mes (YYYY-MM) `delta` meses (negativo = hacia atrás). */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year!, month! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Fecha de hoy en formato ISO YYYY-MM-DD (zona horaria local). */
export function todayISO(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}
