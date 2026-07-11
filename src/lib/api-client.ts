// Cliente de API para los <script> del navegador. Cada función llama a un
// endpoint del servidor y devuelve el dato ya tipado, o lanza un Error con el
// mensaje del servidor (para mostrarlo en la UI).
import type {
  Expense,
  FixedCost,
  House,
  Income,
  NewExpense,
  NewFixedCost,
  NewIncome,
  User,
} from './types';

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function put<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // sin cuerpo
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Error de red. Reintentá.';
    throw new Error(message);
  }
  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function apiRegister(
  username: string,
  displayName: string,
  password: string
): Promise<User> {
  return post<{ user: User }>('/api/register', { username, displayName, password }).then(
    (r) => r.user
  );
}

export function apiLogin(username: string, password: string): Promise<User> {
  return post<{ user: User }>('/api/login', { username, password }).then((r) => r.user);
}

export function apiLogout(): Promise<unknown> {
  return post('/api/logout', {});
}

// ─── Casas ────────────────────────────────────────────────────────────────────

export function apiCreateHouse(name: string): Promise<House> {
  return post<{ house: House }>('/api/houses', { name }).then((r) => r.house);
}

export function apiJoinHouse(code: string): Promise<House> {
  return post<{ house: House }>('/api/houses/join', { code }).then((r) => r.house);
}

export function apiLeaveHouse(houseId: string): Promise<unknown> {
  return post('/api/houses/leave', { houseId });
}

export function apiSetActiveHouse(houseId: string): Promise<House | null> {
  return post<{ house: House | null }>('/api/houses/active', { houseId }).then((r) => r.house);
}

// ─── Gastos / Costos fijos / Ingresos ─────────────────────────────────────────

export function apiAddExpense(input: NewExpense): Promise<Expense> {
  return post<{ expense: Expense }>('/api/expenses', input).then((r) => r.expense);
}

export function apiUpdateExpense(id: string, input: NewExpense): Promise<Expense> {
  return put<{ expense: Expense }>('/api/expenses', { id, ...input }).then((r) => r.expense);
}

export function apiDeleteExpense(id: string): Promise<unknown> {
  return del(`/api/expenses?id=${encodeURIComponent(id)}`);
}

export function apiAddFixedCost(input: NewFixedCost): Promise<FixedCost> {
  return post<{ fixed: FixedCost }>('/api/fixed', input).then((r) => r.fixed);
}

export function apiDeleteFixedCost(id: string): Promise<unknown> {
  return del(`/api/fixed?id=${encodeURIComponent(id)}`);
}

export function apiSetFixedPaid(fixedId: string, month: string, paid: boolean): Promise<unknown> {
  return patch('/api/fixed', { fixedId, month, paid });
}

export function apiAddIncome(input: NewIncome): Promise<Income> {
  return post<{ income: Income }>('/api/income', input).then((r) => r.income);
}

export function apiUpdateIncome(id: string, input: NewIncome): Promise<Income> {
  return put<{ income: Income }>('/api/income', { id, ...input }).then((r) => r.income);
}

export function apiDeleteIncome(id: string): Promise<unknown> {
  return del(`/api/income?id=${encodeURIComponent(id)}`);
}
