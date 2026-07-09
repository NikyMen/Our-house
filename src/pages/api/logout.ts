import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/db';
import { errorResponse, json } from '../../lib/http';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '../../lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const token = cookies.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(token);
    cookies.delete(SESSION_COOKIE, { path: SESSION_COOKIE_OPTIONS.path });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
