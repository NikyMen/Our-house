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
