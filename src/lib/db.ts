// ⚠️ SOLO SERVIDOR. Este módulo habla con PostgreSQL y usa node:crypto.
// Nunca lo importes desde un <script> de cliente.
import pg from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type {
  Expense,
  FixedCost,
  FixedPayment,
  House,
  HouseMember,
  Income,
  NewExpense,
  NewFixedCost,
  NewIncome,
  User,
} from './types';

const { Pool } = pg;

// pg devuelve las columnas `numeric` como string para no perder precisión.
// Como los importes de esta app caben de sobra en un número JS, los parseamos
// a float (OID 1700 = numeric).
pg.types.setTypeParser(1700, (value) => Number.parseFloat(value));

// En producción (node + pm2) la config llega por `process.env`. En desarrollo,
// `astro dev` NO copia el `.env` a `process.env`: lo expone en `import.meta.env`.
// Leemos ambos (con prioridad a `process.env`) para que un `.env` en la raíz
// funcione con `pnpm run dev` sin tener que exportar la variable a mano.
const devEnv = import.meta.env as Record<string, string | undefined>;
const connectionString = process.env.DATABASE_URL ?? devEnv.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Falta la variable de entorno DATABASE_URL (ej: postgres://ourhouse:clave@localhost:5432/ourhouse). ' +
      'En desarrollo, copiá .env.example a .env y completá DATABASE_URL.'
  );
}

// PG_POOL_MAX permite achicar el pool en entornos con pocas conexiones
// (p. ej. una base embebida en desarrollo). Por defecto, el estándar de pg (10).
const poolMax = process.env.PG_POOL_MAX ?? devEnv.PG_POOL_MAX ?? '10';
const pool = new Pool({
  connectionString,
  max: Number.parseInt(poolMax, 10) || 10,
});

/** Error de validación de negocio: se traduce a un HTTP 4xx en los endpoints. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ─── Esquema (se crea solo, una vez, la primera vez que se usa la BD) ─────────

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS users (
          username      text PRIMARY KEY,
          display_name  text NOT NULL,
          password_hash text NOT NULL,
          created_at    timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token      text PRIMARY KEY,
          username   text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS houses (
          id          text PRIMARY KEY,
          name        text NOT NULL,
          invite_code text NOT NULL UNIQUE,
          owner       text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS house_members (
          house_id     text NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
          username     text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
          display_name text NOT NULL,
          joined_at    timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (house_id, username)
        );
        CREATE TABLE IF NOT EXISTS active_house (
          username text PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
          house_id text REFERENCES houses(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id          text PRIMARY KEY,
          house_id    text NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
          description text NOT NULL,
          amount      numeric(12, 2) NOT NULL,
          category    text NOT NULL,
          paid_by     text NOT NULL,
          date        text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS fixed_costs (
          id          text PRIMARY KEY,
          house_id    text NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
          description text NOT NULL,
          amount      numeric(12, 2) NOT NULL,
          category    text NOT NULL,
          paid_by     text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS income (
          id          text PRIMARY KEY,
          house_id    text NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
          description text NOT NULL,
          amount      numeric(12, 2) NOT NULL,
          type        text NOT NULL,
          person      text NOT NULL,
          date        text NOT NULL
        );
        -- Marca de "pagado" de un costo fijo en un mes concreto. Si existe la
        -- fila, está pagado; si no, pendiente.
        CREATE TABLE IF NOT EXISTS fixed_payments (
          fixed_id text NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
          month    text NOT NULL,
          PRIMARY KEY (fixed_id, month)
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_house ON expenses(house_id);
        CREATE INDEX IF NOT EXISTS idx_fixed_house    ON fixed_costs(house_id);
        CREATE INDEX IF NOT EXISTS idx_income_house   ON income(house_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(username);
      `)
      .then(() => undefined)
      .catch((err) => {
        // Si falla, permitir reintentar en la próxima petición.
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

function uid(): string {
  return randomBytes(16).toString('hex');
}

// ─── Contraseñas (scrypt con sal, vía node:crypto) ────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ─── Autenticación y sesiones ────────────────────────────────────────────────

export async function register(
  username: string,
  displayName: string,
  password: string
): Promise<User> {
  await ensureSchema();
  const uname = username.trim().toLowerCase();
  const name = displayName.trim();

  if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
    throw new AppError('El usuario debe tener de 3 a 20 caracteres: letras, números o "_".');
  }
  if (name.length === 0) throw new AppError('Poné tu nombre para mostrar.');
  if (password.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres.');

  const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [uname]);
  if (exists.rowCount) {
    throw new AppError('Ese usuario ya existe. Probá con otro o iniciá sesión.');
  }

  await pool.query(
    'INSERT INTO users (username, display_name, password_hash) VALUES ($1, $2, $3)',
    [uname, name, hashPassword(password)]
  );
  return { username: uname, displayName: name };
}

export async function login(username: string, password: string): Promise<User> {
  await ensureSchema();
  const uname = username.trim().toLowerCase();
  const res = await pool.query<{ display_name: string; password_hash: string }>(
    'SELECT display_name, password_hash FROM users WHERE username = $1',
    [uname]
  );
  const row = res.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AppError('Usuario o contraseña incorrectos.', 401);
  }
  return { username: uname, displayName: row.display_name };
}

/** Crea una sesión y devuelve su token (para guardar en la cookie). */
export async function createSession(username: string): Promise<string> {
  await ensureSchema();
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, username) VALUES ($1, $2)', [token, username]);
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await ensureSchema();
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

/** Devuelve el usuario dueño del token de sesión, o null si no es válido. */
export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  await ensureSchema();
  const res = await pool.query<{ username: string; display_name: string }>(
    `SELECT u.username, u.display_name
       FROM sessions s JOIN users u ON u.username = s.username
      WHERE s.token = $1`,
    [token]
  );
  const row = res.rows[0];
  return row ? { username: row.username, displayName: row.display_name } : null;
}

// ─── Casas ────────────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

async function newInviteCode(): Promise<string> {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const clash = await pool.query('SELECT 1 FROM houses WHERE invite_code = $1', [code]);
    if (!clash.rowCount) return code;
  }
}

async function loadHouse(id: string): Promise<House | null> {
  const houseRes = await pool.query<{
    id: string;
    name: string;
    invite_code: string;
    owner: string;
    created_at: Date;
  }>('SELECT id, name, invite_code, owner, created_at FROM houses WHERE id = $1', [id]);
  const h = houseRes.rows[0];
  if (!h) return null;

  const memberRes = await pool.query<{
    username: string;
    display_name: string;
    joined_at: Date;
  }>(
    `SELECT username, display_name, joined_at
       FROM house_members WHERE house_id = $1 ORDER BY joined_at ASC`,
    [id]
  );

  const members: HouseMember[] = memberRes.rows.map((m) => ({
    username: m.username,
    displayName: m.display_name,
    joinedAt: m.joined_at.toISOString(),
  }));

  return {
    id: h.id,
    name: h.name,
    inviteCode: h.invite_code,
    owner: h.owner,
    members,
    createdAt: h.created_at.toISOString(),
  };
}

async function isMember(houseId: string, username: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM house_members WHERE house_id = $1 AND username = $2', [
    houseId,
    username,
  ]);
  return Boolean(res.rowCount);
}

/** Casas de las que el usuario es integrante (con sus integrantes). */
export async function housesOf(username: string): Promise<House[]> {
  await ensureSchema();
  const res = await pool.query<{ house_id: string }>(
    'SELECT house_id FROM house_members WHERE username = $1',
    [username]
  );
  const houses: House[] = [];
  for (const row of res.rows) {
    const house = await loadHouse(row.house_id);
    if (house) houses.push(house);
  }
  houses.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return houses;
}

export async function createHouse(name: string, user: User): Promise<House> {
  await ensureSchema();
  const houseName = name.trim();
  if (houseName.length === 0) throw new AppError('Poné un nombre para la casa.');
  if (houseName.length > 40) throw new AppError('El nombre es demasiado largo (máx. 40).');

  const id = uid();
  const code = await newInviteCode();
  await pool.query('INSERT INTO houses (id, name, invite_code, owner) VALUES ($1, $2, $3, $4)', [
    id,
    houseName,
    code,
    user.username,
  ]);
  await pool.query(
    'INSERT INTO house_members (house_id, username, display_name) VALUES ($1, $2, $3)',
    [id, user.username, user.displayName]
  );
  await setActiveHouse(user.username, id);
  return (await loadHouse(id))!;
}

export async function joinHouse(code: string, user: User): Promise<House> {
  await ensureSchema();
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) throw new AppError('Ingresá el código de invitación.');

  const res = await pool.query<{ id: string }>('SELECT id FROM houses WHERE invite_code = $1', [
    normalized,
  ]);
  const house = res.rows[0];
  if (!house) throw new AppError('No existe ninguna casa con ese código.');
  if (await isMember(house.id, user.username)) {
    throw new AppError('Ya sos integrante de esa casa.');
  }

  await pool.query(
    'INSERT INTO house_members (house_id, username, display_name) VALUES ($1, $2, $3)',
    [house.id, user.username, user.displayName]
  );
  await setActiveHouse(user.username, house.id);
  return (await loadHouse(house.id))!;
}

/**
 * Saca al usuario de la casa. Si queda vacía se elimina (junto con sus datos);
 * si se va quien la creó, la "hereda" el siguiente integrante.
 */
export async function leaveHouse(houseId: string, username: string): Promise<void> {
  await ensureSchema();
  const house = await loadHouse(houseId);
  if (!house) return;

  await pool.query('DELETE FROM house_members WHERE house_id = $1 AND username = $2', [
    houseId,
    username,
  ]);

  const remaining = house.members.filter((m) => m.username !== username);
  if (remaining.length === 0) {
    await pool.query('DELETE FROM houses WHERE id = $1', [houseId]);
  } else if (house.owner === username) {
    await pool.query('UPDATE houses SET owner = $1 WHERE id = $2', [remaining[0]!.username, houseId]);
  }

  // Si esta era la casa activa del usuario, limpiar la selección.
  const active = await getActiveHouseId(username);
  if (active === houseId) await setActiveHouse(username, null);
}

export async function getActiveHouseId(username: string): Promise<string | null> {
  const res = await pool.query<{ house_id: string | null }>(
    'SELECT house_id FROM active_house WHERE username = $1',
    [username]
  );
  return res.rows[0]?.house_id ?? null;
}

export async function setActiveHouse(username: string, houseId: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO active_house (username, house_id) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET house_id = EXCLUDED.house_id`,
    [username, houseId]
  );
}

/**
 * Casa activa del usuario, validando que siga existiendo y que siga siendo
 * integrante. Si no, devuelve null (y limpia la selección).
 */
export async function getActiveHouse(user: User): Promise<House | null> {
  await ensureSchema();
  const id = await getActiveHouseId(user.username);
  if (!id) return null;
  const house = await loadHouse(id);
  if (!house || !house.members.some((m) => m.username === user.username)) {
    await setActiveHouse(user.username, null);
    return null;
  }
  return house;
}

/** Verifica que el usuario sea integrante de la casa o lanza 403. */
async function assertMember(houseId: string, username: string): Promise<void> {
  if (!(await isMember(houseId, username))) {
    throw new AppError('No pertenecés a esa casa.', 403);
  }
}

// ─── Gastos / Costos fijos / Ingresos ─────────────────────────────────────────

export async function loadExpenses(houseId: string): Promise<Expense[]> {
  await ensureSchema();
  const res = await pool.query<{
    id: string;
    description: string;
    amount: number;
    category: string;
    paid_by: string;
    date: string;
  }>(
    'SELECT id, description, amount, category, paid_by, date FROM expenses WHERE house_id = $1',
    [houseId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    category: r.category as Expense['category'],
    paidBy: r.paid_by,
    date: r.date,
  }));
}

export async function addExpense(
  houseId: string,
  username: string,
  input: NewExpense
): Promise<Expense> {
  await ensureSchema();
  await assertMember(houseId, username);
  const expense: Expense = { id: uid(), ...input };
  await pool.query(
    `INSERT INTO expenses (id, house_id, description, amount, category, paid_by, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      expense.id,
      houseId,
      expense.description,
      expense.amount,
      expense.category,
      expense.paidBy,
      expense.date,
    ]
  );
  return expense;
}

export async function updateExpense(
  houseId: string,
  username: string,
  id: string,
  input: NewExpense
): Promise<Expense> {
  await ensureSchema();
  await assertMember(houseId, username);
  const res = await pool.query(
    `UPDATE expenses
        SET description = $1, amount = $2, category = $3, paid_by = $4, date = $5
      WHERE id = $6 AND house_id = $7`,
    [input.description, input.amount, input.category, input.paidBy, input.date, id, houseId]
  );
  if (!res.rowCount) throw new AppError('No se encontró el gasto.', 404);
  return { id, ...input };
}

export async function deleteExpense(houseId: string, username: string, id: string): Promise<void> {
  await ensureSchema();
  await assertMember(houseId, username);
  await pool.query('DELETE FROM expenses WHERE id = $1 AND house_id = $2', [id, houseId]);
}

export async function loadFixedCosts(houseId: string): Promise<FixedCost[]> {
  await ensureSchema();
  const res = await pool.query<{
    id: string;
    description: string;
    amount: number;
    category: string;
    paid_by: string;
  }>('SELECT id, description, amount, category, paid_by FROM fixed_costs WHERE house_id = $1', [
    houseId,
  ]);
  return res.rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    category: r.category as FixedCost['category'],
    paidBy: r.paid_by,
  }));
}

export async function addFixedCost(
  houseId: string,
  username: string,
  input: NewFixedCost
): Promise<FixedCost> {
  await ensureSchema();
  await assertMember(houseId, username);
  const fixed: FixedCost = { id: uid(), ...input };
  await pool.query(
    `INSERT INTO fixed_costs (id, house_id, description, amount, category, paid_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [fixed.id, houseId, fixed.description, fixed.amount, fixed.category, fixed.paidBy]
  );
  return fixed;
}

export async function deleteFixedCost(houseId: string, username: string, id: string): Promise<void> {
  await ensureSchema();
  await assertMember(houseId, username);
  await pool.query('DELETE FROM fixed_costs WHERE id = $1 AND house_id = $2', [id, houseId]);
}

/** Marcas de "pagado" de los costos fijos de una casa (todos los meses). */
export async function loadFixedPayments(houseId: string): Promise<FixedPayment[]> {
  await ensureSchema();
  const res = await pool.query<{ fixed_id: string; month: string }>(
    `SELECT fp.fixed_id, fp.month
       FROM fixed_payments fp
       JOIN fixed_costs f ON f.id = fp.fixed_id
      WHERE f.house_id = $1`,
    [houseId]
  );
  return res.rows.map((r) => ({ fixedId: r.fixed_id, month: r.month }));
}

/** Marca o desmarca un costo fijo como pagado en un mes (YYYY-MM). */
export async function setFixedPaid(
  houseId: string,
  username: string,
  fixedId: string,
  month: string,
  paid: boolean
): Promise<void> {
  await ensureSchema();
  await assertMember(houseId, username);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError('Mes inválido.');

  // El costo fijo debe pertenecer a la casa.
  const owns = await pool.query('SELECT 1 FROM fixed_costs WHERE id = $1 AND house_id = $2', [
    fixedId,
    houseId,
  ]);
  if (!owns.rowCount) throw new AppError('No se encontró el costo fijo.', 404);

  if (paid) {
    await pool.query(
      `INSERT INTO fixed_payments (fixed_id, month) VALUES ($1, $2)
         ON CONFLICT (fixed_id, month) DO NOTHING`,
      [fixedId, month]
    );
  } else {
    await pool.query('DELETE FROM fixed_payments WHERE fixed_id = $1 AND month = $2', [
      fixedId,
      month,
    ]);
  }
}

export async function loadIncome(houseId: string): Promise<Income[]> {
  await ensureSchema();
  const res = await pool.query<{
    id: string;
    description: string;
    amount: number;
    type: string;
    person: string;
    date: string;
  }>('SELECT id, description, amount, type, person, date FROM income WHERE house_id = $1', [
    houseId,
  ]);
  return res.rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    type: r.type as Income['type'],
    person: r.person,
    date: r.date,
  }));
}

export async function addIncome(
  houseId: string,
  username: string,
  input: NewIncome
): Promise<Income> {
  await ensureSchema();
  await assertMember(houseId, username);
  const income: Income = { id: uid(), ...input };
  await pool.query(
    `INSERT INTO income (id, house_id, description, amount, type, person, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      income.id,
      houseId,
      income.description,
      income.amount,
      income.type,
      income.person,
      income.date,
    ]
  );
  return income;
}

export async function updateIncome(
  houseId: string,
  username: string,
  id: string,
  input: NewIncome
): Promise<Income> {
  await ensureSchema();
  await assertMember(houseId, username);
  const res = await pool.query(
    `UPDATE income
        SET description = $1, amount = $2, type = $3, person = $4, date = $5
      WHERE id = $6 AND house_id = $7`,
    [input.description, input.amount, input.type, input.person, input.date, id, houseId]
  );
  if (!res.rowCount) throw new AppError('No se encontró el ingreso.', 404);
  return { id, ...input };
}

export async function deleteIncome(houseId: string, username: string, id: string): Promise<void> {
  await ensureSchema();
  await assertMember(houseId, username);
  await pool.query('DELETE FROM income WHERE id = $1 AND house_id = $2', [id, houseId]);
}
