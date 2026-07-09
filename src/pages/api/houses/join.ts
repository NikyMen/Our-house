import type { APIRoute } from 'astro';
import { joinHouse } from '../../../lib/db';
import { errorResponse, json, readJson, requireUser } from '../../../lib/http';

export const prerender = false;

// Unirse a una casa con su código de invitación (queda como casa activa).
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const body = await readJson(request);
    const house = await joinHouse(String(body.code ?? ''), user);
    return json({ house });
  } catch (err) {
    return errorResponse(err);
  }
};
