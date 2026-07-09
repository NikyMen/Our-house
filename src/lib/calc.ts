// Funciones de cálculo puras (sin acceso a datos). Sirven tanto en el
// navegador como en el servidor: reciben arrays y devuelven totales/filtros.
import type { CategoryId, Expense, FixedCost, Income } from './types';
import { monthKeyOf } from './format';

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

export function totalsByPerson(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount);
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
