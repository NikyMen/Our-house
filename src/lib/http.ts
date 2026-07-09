// Utilidades para los endpoints de API (solo servidor).
import { AppError } from './db';
import type { User } from './types';

/** Exige un usuario autenticado en `locals` o lanza 401. */
export function requireUser(locals: App.Locals): User {
  if (!locals.user) throw new AppError('Iniciá sesión para continuar.', 401);
  return locals.user;
}

/** Parsea un importe positivo o lanza 400. */
export function parseAmount(value: unknown): number {
  const amount = Number.parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('El importe debe ser un número mayor que cero.');
  }
  return Math.round(amount * 100) / 100;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Traduce un error a una respuesta JSON: AppError → su status; resto → 500. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return json({ error: err.message }, err.status);
  }
  console.error('[api] error inesperado:', err);
  return json({ error: 'Ocurrió un error en el servidor.' }, 500);
}

/** Lee y valida el cuerpo JSON de la petición como objeto. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null) throw new Error('no-object');
    return body as Record<string, unknown>;
  } catch {
    throw new AppError('Cuerpo de la petición inválido.');
  }
}
