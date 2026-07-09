export interface Expense {
  id: string;
  /** Descripción del gasto, p. ej. "Compra semanal" */
  description: string;
  /** Importe en la moneda configurada (siempre positivo) */
  amount: number;
  /** Clave de la categoría (ver CATEGORIES) */
  category: CategoryId;
  /** Quién lo pagó */
  paidBy: string;
  /** Fecha en formato ISO YYYY-MM-DD */
  date: string;
}

export type CategoryId =
  | 'comida'
  | 'hogar'
  | 'servicios'
  | 'transporte'
  | 'salud'
  | 'ocio'
  | 'otros';

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'comida', label: 'Comida', emoji: '🛒', color: '#22c55e' },
  { id: 'hogar', label: 'Hogar', emoji: '🏠', color: '#3b82f6' },
  { id: 'servicios', label: 'Servicios', emoji: '💡', color: '#eab308' },
  { id: 'transporte', label: 'Transporte', emoji: '🚗', color: '#f97316' },
  { id: 'salud', label: 'Salud', emoji: '💊', color: '#ef4444' },
  { id: 'ocio', label: 'Ocio', emoji: '🎉', color: '#a855f7' },
  { id: 'otros', label: 'Otros', emoji: '📦', color: '#64748b' },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export type IncomeType = 'sueldo' | 'extra';

export const INCOME_TYPES: { id: IncomeType; label: string; emoji: string }[] = [
  { id: 'sueldo', label: 'Sueldo', emoji: '💼' },
  { id: 'extra', label: 'Ingreso extra', emoji: '💸' },
];

export interface Income {
  id: string;
  description: string;
  amount: number;
  type: IncomeType;
  person: string;
  date: string;
}

/** Costo fijo: gasto recurrente que aplica todos los meses (sin fecha). */
export interface FixedCost {
  id: string;
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
}

// ─── Cuentas y casas ───────────────────────────────────────────────────────

export interface User {
  username: string;
  displayName: string;
}

export interface HouseMember {
  username: string;
  displayName: string;
  joinedAt: string;
}

export interface House {
  id: string;
  name: string;
  /** Código corto para invitar a otros integrantes. */
  inviteCode: string;
  /** Username de quien creó la casa. */
  owner: string;
  members: HouseMember[];
  createdAt: string;
}

// ─── Entradas de creación (lo que manda el cliente al servidor) ──────────────

export interface NewExpense {
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
  date: string;
}

export interface NewFixedCost {
  description: string;
  amount: number;
  category: CategoryId;
  paidBy: string;
}

export interface NewIncome {
  description: string;
  amount: number;
  type: IncomeType;
  person: string;
  date: string;
}
