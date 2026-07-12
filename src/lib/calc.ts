// Funciones de cálculo puras (sin acceso a datos). Sirven tanto en el
// navegador como en el servidor: reciben arrays y devuelven totales/filtros.
import type { CategoryId, Expense, FixedCost, Income } from './types';
import { SHARED_PAYER } from './types';
import { daysInMonth, monthKeyOf, shiftMonth } from './format';

// ─── Gastos ──────────────────────────────────────────────────────────────────

/** Meses presentes en los datos, en orden descendente (más reciente primero). */
export function availableMonths(expenses: Expense[]): string[] {
  const set = new Set(expenses.map((e) => monthKeyOf(e.date)));
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function filterByMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses
    .filter((e) => monthKeyOf(e.date) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function total(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function totalsByCategory(expenses: Expense[]): Map<CategoryId, number> {
  const map = new Map<CategoryId, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return map;
}

/**
 * Total que le corresponde a cada persona. Los gastos marcados como
 * compartidos (paidBy === SHARED_PAYER) se reparten en partes iguales entre
 * los integrantes indicados. Si no se pasan integrantes, el gasto compartido
 * se agrupa bajo la etiqueta "Ambos".
 */
export function totalsByPerson(expenses: Expense[], members: string[] = []): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.paidBy === SHARED_PAYER && members.length > 0) {
      const share = e.amount / members.length;
      for (const m of members) map.set(m, (map.get(m) ?? 0) + share);
    } else {
      map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount);
    }
  }
  return map;
}

// ─── Costos fijos ────────────────────────────────────────────────────────────

export function fixedCostsTotal(fixed: FixedCost[]): number {
  return fixed.reduce((sum, f) => sum + f.amount, 0);
}

/**
 * Convierte los costos fijos en gastos "virtuales" para un mes dado, así pueden
 * sumarse a los gastos reales en los totales por categoría y por persona.
 */
export function fixedAsExpenses(fixed: FixedCost[], monthKey: string): Expense[] {
  return fixed.map((f) => ({
    id: `fixed:${f.id}`,
    description: f.description,
    amount: f.amount,
    category: f.category,
    paidBy: f.paidBy,
    date: `${monthKey}-01`,
  }));
}

// ─── Ingresos ─────────────────────────────────────────────────────────────────

export function incomeTotal(income: Income[]): number {
  return income.reduce((sum, i) => sum + i.amount, 0);
}

export function filterIncomeByMonth(income: Income[], monthKey: string): Income[] {
  return income
    .filter((i) => monthKeyOf(i.date) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Métricas y series para gráficos ─────────────────────────────────────────

/**
 * Gasto acumulado por día de un mes. Devuelve un array de `daysInMonth`
 * posiciones (índice 0 = día 1) con el total acumulado hasta ese día,
 * incluyendo los costos fijos como gasto del día 1.
 */
export function cumulativeByDay(
  expenses: Expense[],
  fixed: FixedCost[],
  monthKey: string
): number[] {
  const days = daysInMonth(monthKey);
  const perDay = new Array<number>(days).fill(0);
  perDay[0] = fixedCostsTotal(fixed);
  for (const e of expenses) {
    if (monthKeyOf(e.date) !== monthKey) continue;
    const day = Number(e.date.slice(8, 10));
    if (day >= 1 && day <= days) perDay[day - 1]! += e.amount;
  }
  let running = 0;
  return perDay.map((v) => (running += v));
}

export interface MonthlyPoint {
  month: string;
  gastos: number;
  ingresos: number;
  saldo: number;
}

/**
 * Totales por mes de los últimos `n` meses terminando en `endMonth`
 * (ambos incluidos), con los costos fijos sumados a los gastos de cada mes.
 */
export function monthlySeries(
  expenses: Expense[],
  income: Income[],
  fixed: FixedCost[],
  endMonth: string,
  n: number
): MonthlyPoint[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) months.push(shiftMonth(endMonth, -i));

  const gastosPorMes = new Map<string, number>();
  for (const e of expenses) {
    const key = monthKeyOf(e.date);
    gastosPorMes.set(key, (gastosPorMes.get(key) ?? 0) + e.amount);
  }
  const ingresosPorMes = new Map<string, number>();
  for (const i of income) {
    const key = monthKeyOf(i.date);
    ingresosPorMes.set(key, (ingresosPorMes.get(key) ?? 0) + i.amount);
  }

  const fijos = fixedCostsTotal(fixed);
  return months.map((month) => {
    const gastos = (gastosPorMes.get(month) ?? 0) + fijos;
    const ingresos = ingresosPorMes.get(month) ?? 0;
    return { month, gastos, ingresos, saldo: ingresos - gastos };
  });
}

/** Entrada del desglose de la dona: top `n` categorías + "resto" agrupado. */
export interface DonutSlice {
  category: CategoryId | null;
  amount: number;
}

/**
 * Agrupa los totales por categoría en las `n` más grandes + un segmento
 * "resto" (category = null) con la suma de las demás.
 */
export function donutSlices(byCategory: Map<CategoryId, number>, n: number): DonutSlice[] {
  const sorted = [...byCategory.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n).map(([category, amount]) => ({ category, amount }));
  const rest = sorted.slice(n).reduce((sum, [, amount]) => sum + amount, 0);
  return rest > 0 ? [...top, { category: null, amount: rest }] : top;
}
