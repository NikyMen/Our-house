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

/**
 * Valor especial de `paidBy` que indica un gasto compartido a partes iguales
 * entre todos los integrantes de la casa (mitad y mitad si son dos).
 */
export const SHARED_PAYER = 'Ambos';

export type CategoryId =
  | 'comida'
  | 'hogar'
  | 'servicios'
  | 'transporte'
  | 'salud'
  | 'ocio'
  | 'supermercado'
  | 'peluqueria'
  | 'cocacola'
  | 'yerba'
  | 'kiosko'
  | 'verduleria'
  | 'farmacia'
  | 'nafta'
  | 'seguro'
  | 'gimnasio'
  | 'ropa'
  | 'prestamos'
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
  { id: 'supermercado', label: 'Supermercado', emoji: '🛒', color: '#16a34a' },
  { id: 'peluqueria', label: 'Peluquería', emoji: '💇', color: '#ec4899' },
  { id: 'cocacola', label: 'Coca-Cola', emoji: '🥤', color: '#dc2626' },
  { id: 'yerba', label: 'Yerba', emoji: '🧉', color: '#65a30d' },
  { id: 'kiosko', label: 'Kiosko', emoji: '🏪', color: '#0ea5e9' },
  { id: 'verduleria', label: 'Verdulería', emoji: '🥬', color: '#4ade80' },
  { id: 'farmacia', label: 'Farmacia', emoji: '💊', color: '#14b8a6' },
  { id: 'nafta', label: 'Nafta', emoji: '⛽', color: '#f59e0b' },
  { id: 'seguro', label: 'Seguro', emoji: '🛡️', color: '#6366f1' },
  { id: 'gimnasio', label: 'Gimnasio', emoji: '🏋️', color: '#8b5cf6' },
  { id: 'ropa', label: 'Ropa', emoji: '👕', color: '#f472b6' },
  { id: 'prestamos', label: 'Préstamos', emoji: '💳', color: '#e11d48' },
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

/** Marca de "pagado" de un costo fijo para un mes concreto (YYYY-MM). */
export interface FixedPayment {
  fixedId: string;
  month: string;
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
