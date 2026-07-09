// Nombre y opciones de la cookie de sesión (compartidos por el middleware y los
// endpoints). Sin `secure` para que funcione también sobre HTTP; el día que
// pongas HTTPS conviene añadir `secure: true`.
import type { AstroCookieSetOptions } from 'astro';

export const SESSION_COOKIE = 'ourhouse_session';

export const SESSION_COOKIE_OPTIONS: AstroCookieSetOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 días
};
