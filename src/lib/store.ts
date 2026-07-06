import type { CategoryId, Expense, Income, IncomeType } from './types';
import { monthKeyOf } from './format';

// Cada casa guarda sus datos bajo su propia clave de localStorage.
type Kind = 'expenses' | 'fixedcosts' | 'income';

function keyFor(kind: Kind, houseId: string): string {
  return `ourhouse.${kind}.v2.${houseId}`;
}

// Claves de la versión anterior (sin casas), para migrar datos existentes.
const LEGACY_KEYS: Record<Kind, string> = {
  expenses: 'ourhouse.expenses.v1',
  fixedcosts: 'ourhouse.fixedcosts.v1',
  income: 'ourhouse.income.v1',
};

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadArray<T>(key: string, guard: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

/**
 * Mueve los datos de la versión sin casas (si los hay) a la casa indicada.
 * Pensado para llamarse al crear la primera casa del navegador, así no se
 * pierde lo que ya estaba cargado. Devuelve true si migró algo.
 */
export function migrateLegacyData(houseId: string): boolean {
  let migrated = false;
  for (const kind of Object.keys(LEGACY_KEYS) as Kind[]) {
    const legacy = localStorage.getItem(LEGACY_KEYS[kind]);
    if (legacy === null) continue;
    if (localStorage.getItem(keyFor(kind, houseId)) === null) {
      localStorage.setItem(keyFor(kind, houseId), legacy);
      migrated = true;
    }
    localStorage.removeItem(LEGACY_KEYS[kind]);
  }
  return migrated;
}

// ─── Gastos ──────────────────────────────────────────────────────────────────

function isExpense(value: unknown): value is Expense {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.description === 'string' &&
    typeof e.amount === 'number' &&
    typeof e.category === 'string' &&
    typeof e.paidBy === 'string' &&
    typeof e.date === 'string'
  );
}

export function loadExpenses(houseId: string): Expense[] {
  return loadArray(keyFor('expenses', houseId), isExpense);
}

function saveExpenses(houseId: string, expenses: Expense[]): void {
  localStorage.setItem(keyFor('expenses', houseId), JSON.stringify(expenses));
}

export interface NewExpense {
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
  date: string;
}

export function addExpense(houseId: string, input: NewExpense): Expense[] {
  const expenses = loadExpenses(houseId);
  const expense: Expense = { id: uid(), ...input };
  expenses.push(expense);
  saveExpenses(houseId, expenses);
  return expenses;
}

export function deleteExpense(houseId: string, id: string): Expense[] {
  const expenses = loadExpenses(houseId).filter((e) => e.id !== id);
  saveExpenses(houseId, expenses);
  return expenses;
}

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
// Gastos recurrentes (alquiler, servicios, etc.) que se aplican TODOS los meses.
// No tienen fecha: cuentan para cualquier mes seleccionado.

export interface FixedCost {
  id: string;
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
}

export interface NewFixedCost {
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
}

function isFixedCost(value: unknown): value is FixedCost {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === 'string' &&
    typeof f.description === 'string' &&
    typeof f.amount === 'number' &&
    typeof f.category === 'string' &&
    typeof f.paidBy === 'string'
  );
}

export function loadFixedCosts(houseId: string): FixedCost[] {
  return loadArray(keyFor('fixedcosts', houseId), isFixedCost);
}

function saveFixedCosts(houseId: string, fixed: FixedCost[]): void {
  localStorage.setItem(keyFor('fixedcosts', houseId), JSON.stringify(fixed));
}

export function addFixedCost(houseId: string, input: NewFixedCost): FixedCost[] {
  const fixed = loadFixedCosts(houseId);
  fixed.push({ id: uid(), ...input });
  saveFixedCosts(houseId, fixed);
  return fixed;
}

export function deleteFixedCost(houseId: string, id: string): FixedCost[] {
  const fixed = loadFixedCosts(houseId).filter((f) => f.id !== id);
  saveFixedCosts(houseId, fixed);
  return fixed;
}

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

export interface NewIncome {
  description: string;
  amount: number;
  type: IncomeType;
  person: string;
  date: string;
}

function isIncome(value: unknown): value is Income {
  if (typeof value !== 'object' || value === null) return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.description === 'string' &&
    typeof i.amount === 'number' &&
    typeof i.type === 'string' &&
    typeof i.person === 'string' &&
    typeof i.date === 'string'
  );
}

export function loadIncome(houseId: string): Income[] {
  return loadArray(keyFor('income', houseId), isIncome);
}

function saveIncome(houseId: string, income: Income[]): void {
  localStorage.setItem(keyFor('income', houseId), JSON.stringify(income));
}

export function addIncome(houseId: string, input: NewIncome): Income[] {
  const income = loadIncome(houseId);
  income.push({ id: uid(), ...input });
  saveIncome(houseId, income);
  return income;
}

export function deleteIncome(houseId: string, id: string): Income[] {
  const income = loadIncome(houseId).filter((i) => i.id !== id);
  saveIncome(houseId, income);
  return income;
}

export function incomeTotal(income: Income[]): number {
  return income.reduce((sum, i) => sum + i.amount, 0);
}

export function filterIncomeByMonth(income: Income[], monthKey: string): Income[] {
  return income
    .filter((i) => monthKeyOf(i.date) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date));
}
