import type { APIRoute } from 'astro';
import { AppError, leaveHouse } from '../../../lib/db';
import { errorResponse, json, readJson, requireUser } from '../../../lib/http';

export const prerender = false;

// Abandonar una casa.
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const body = await readJson(request);
    const houseId = String(body.houseId ?? '');
    if (!houseId) throw new AppError('Falta el id de la casa.');
    await leaveHouse(houseId, user.username);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
