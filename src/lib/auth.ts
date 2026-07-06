// ⚠️ AVISO DE SEGURIDAD
// Esta es una autenticación SOLO DEL LADO DEL CLIENTE pensada para una app
// local/casera sin servidor. Los usuarios y sus contraseñas (hasheadas con
// SHA-256, sin sal) viven en el localStorage del navegador. NO uses esto para
// proteger datos sensibles ni lo publiques en internet tal cual. Para
// seguridad real hace falta un backend con sesiones y contraseñas hasheadas.

export interface User {
  username: string;
  displayName: string;
}

interface StoredUser extends User {
  passwordHash: string;
  createdAt: string;
}

const USERS_KEY = 'ourhouse.users.v1';
const SESSION_KEY = 'ourhouse.session.v1';

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Sin crypto.subtle (contexto no seguro): se guarda marcado como texto plano.
  return `plain:${password}`;
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredUser);
  } catch {
    return [];
  }
}

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== 'object' || value === null) return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u.username === 'string' &&
    typeof u.displayName === 'string' &&
    typeof u.passwordHash === 'string'
  );
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Crea una cuenta nueva. Devuelve el usuario creado (y deja la sesión
 * iniciada) o un mensaje de error si algo falla.
 */
export async function register(
  username: string,
  displayName: string,
  password: string
): Promise<User | string> {
  const uname = username.trim().toLowerCase();
  const name = displayName.trim();

  if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
    return 'El usuario debe tener de 3 a 20 caracteres: letras, números o "_".';
  }
  if (name.length === 0) return 'Poné tu nombre para mostrar.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';

  const users = loadUsers();
  if (users.some((u) => u.username === uname)) {
    return 'Ese usuario ya existe. Probá con otro o iniciá sesión.';
  }

  const stored: StoredUser = {
    username: uname,
    displayName: name,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(stored);
  saveUsers(users);

  const session: User = { username: stored.username, displayName: stored.displayName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Valida credenciales y, si son correctas, guarda la sesión. */
export async function login(username: string, password: string): Promise<User | null> {
  const uname = username.trim().toLowerCase();
  const match = loadUsers().find((u) => u.username === uname);
  if (!match) return null;

  const hash = await hashPassword(password);
  if (match.passwordHash !== hash && match.passwordHash !== `plain:${password}`) {
    return null;
  }

  const session: User = { username: match.username, displayName: match.displayName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** Devuelve el usuario de la sesión activa, o null si no hay sesión. */
export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).username === 'string' &&
      typeof (parsed as Record<string, unknown>).displayName === 'string'
    ) {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

/** Lista de usuarios registrados (sin contraseñas), por si la UI los necesita. */
export function listUsers(): User[] {
  return loadUsers().map(({ username, displayName }) => ({ username, displayName }));
}
