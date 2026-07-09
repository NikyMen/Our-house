import type { APIRoute } from 'astro';
import { createSession, login } from '../../lib/db';
import { errorResponse, json, readJson } from '../../lib/http';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '../../lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await readJson(request);
    const user = await login(String(body.username ?? ''), String(body.password ?? ''));
    const token = await createSession(user.username);
    cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return json({ user });
  } catch (err) {
    return errorResponse(err);
  }
};
