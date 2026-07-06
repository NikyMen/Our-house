import type { User } from './auth';

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

const HOUSES_KEY = 'ourhouse.houses.v1';
// Mapa username -> houseId con la casa activa de cada usuario.
const ACTIVE_KEY = 'ourhouse.activehouse.v1';

// Sin caracteres confusos (0/O, 1/I/L) para que el código sea fácil de dictar.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isHouseMember(value: unknown): value is HouseMember {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.username === 'string' && typeof m.displayName === 'string';
}

function isHouse(value: unknown): value is House {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === 'string' &&
    typeof h.name === 'string' &&
    typeof h.inviteCode === 'string' &&
    typeof h.owner === 'string' &&
    Array.isArray(h.members) &&
    h.members.every(isHouseMember)
  );
}

export function loadHouses(): House[] {
  try {
    const raw = localStorage.getItem(HOUSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHouse);
  } catch {
    return [];
  }
}

function saveHouses(houses: House[]): void {
  localStorage.setItem(HOUSES_KEY, JSON.stringify(houses));
}

function newInviteCode(existing: Set<string>): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
}

export function isMember(house: House, username: string): boolean {
  return house.members.some((m) => m.username === username);
}

/** Casas de las que el usuario es integrante. */
export function housesOf(username: string): House[] {
  return loadHouses().filter((h) => isMember(h, username));
}

export function createHouse(name: string, user: User): House | string {
  const houseName = name.trim();
  if (houseName.length === 0) return 'Poné un nombre para la casa.';
  if (houseName.length > 40) return 'El nombre es demasiado largo (máx. 40).';

  const houses = loadHouses();
  const codes = new Set(houses.map((h) => h.inviteCode));
  const now = new Date().toISOString();
  const house: House = {
    id: uid(),
    name: houseName,
    inviteCode: newInviteCode(codes),
    owner: user.username,
    members: [{ username: user.username, displayName: user.displayName, joinedAt: now }],
    createdAt: now,
  };
  houses.push(house);
  saveHouses(houses);
  return house;
}

/** Une al usuario a la casa cuyo código de invitación coincida. */
export function joinHouse(code: string, user: User): House | string {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) return 'Ingresá el código de invitación.';

  const houses = loadHouses();
  const house = houses.find((h) => h.inviteCode === normalized);
  if (!house) return 'No existe ninguna casa con ese código en este navegador.';
  if (isMember(house, user.username)) return 'Ya sos integrante de esa casa.';

  house.members.push({
    username: user.username,
    displayName: user.displayName,
    joinedAt: new Date().toISOString(),
  });
  saveHouses(houses);
  return house;
}

/**
 * Saca al usuario de la casa. Si la casa queda vacía se elimina; si se va
 * quien la creó, la "hereda" el siguiente integrante.
 */
export function leaveHouse(houseId: string, username: string): void {
  const houses = loadHouses();
  const house = houses.find((h) => h.id === houseId);
  if (!house) return;

  house.members = house.members.filter((m) => m.username !== username);
  if (house.members.length === 0) {
    saveHouses(houses.filter((h) => h.id !== houseId));
  } else {
    if (house.owner === username) house.owner = house.members[0]!.username;
    saveHouses(houses);
  }
  if (getActiveHouseId(username) === houseId) setActiveHouse(username, null);
}

function loadActiveMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') map[k] = v;
    }
    return map;
  } catch {
    return {};
  }
}

export function getActiveHouseId(username: string): string | null {
  return loadActiveMap()[username] ?? null;
}

export function setActiveHouse(username: string, houseId: string | null): void {
  const map = loadActiveMap();
  if (houseId === null) {
    delete map[username];
  } else {
    map[username] = houseId;
  }
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(map));
}

/**
 * Casa activa del usuario, validando que siga existiendo y que siga siendo
 * integrante. Si no, devuelve null (y limpia la selección).
 */
export function getActiveHouse(user: User): House | null {
  const id = getActiveHouseId(user.username);
  if (!id) return null;
  const house = loadHouses().find((h) => h.id === id);
  if (!house || !isMember(house, user.username)) {
    setActiveHouse(user.username, null);
    return null;
  }
  return house;
}
