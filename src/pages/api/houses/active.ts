import type { APIRoute } from 'astro';
import { AppError, getActiveHouse, setActiveHouse } from '../../../lib/db';
import { errorResponse, json, readJson, requireUser } from '../../../lib/http';
import { housesOf } from '../../../lib/db';

export const prerender = false;

// Elegir la casa activa del usuario. Verifica que sea integrante.
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const body = await readJson(request);
    const houseId = String(body.houseId ?? '');
    if (!houseId) throw new AppError('Falta el id de la casa.');

    const houses = await housesOf(user.username);
    if (!houses.some((h) => h.id === houseId)) {
      throw new AppError('No pertenecés a esa casa.', 403);
    }
    await setActiveHouse(user.username, houseId);
    const active = await getActiveHouse(user);
    return json({ house: active });
  } catch (err) {
    return errorResponse(err);
  }
};
