import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/db';
import { SESSION_COOKIE } from './lib/session';

// En cada petición resuelve el usuario a partir de la cookie de sesión y lo
// deja en `context.locals.user` (o null). Las páginas y endpoints lo usan para
// proteger rutas.
export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  try {
    context.locals.user = await getSessionUser(token);
  } catch {
    // Si la BD no está disponible, tratamos al usuario como no autenticado.
    context.locals.user = null;
  }
  return next();
});
