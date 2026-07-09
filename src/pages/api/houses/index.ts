import type { APIRoute } from 'astro';
import { createHouse } from '../../../lib/db';
import { errorResponse, json, readJson, requireUser } from '../../../lib/http';

export const prerender = false;

// Crear una casa nueva (queda como casa activa del usuario).
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const body = await readJson(request);
    const house = await createHouse(String(body.name ?? ''), user);
    return json({ house });
  } catch (err) {
    return errorResponse(err);
  }
};
