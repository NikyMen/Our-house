import type { APIRoute } from 'astro';
import { AppError, addFixedCost, deleteFixedCost, getActiveHouse } from '../../lib/db';
import { errorResponse, json, parseAmount, readJson, requireUser } from '../../lib/http';
import type { CategoryId } from '../../lib/types';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const house = await getActiveHouse(user);
    if (!house) throw new AppError('No tenés una casa activa.', 409);

    const body = await readJson(request);
    const fixed = await addFixedCost(house.id, user.username, {
      description: String(body.description ?? '').trim(),
      amount: parseAmount(body.amount),
      category: String(body.category ?? 'otros') as CategoryId,
      paidBy: String(body.paidBy ?? '').trim(),
    });
    return json({ fixed });
  } catch (err) {
    return errorResponse(err);
  }
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  try {
    const user = requireUser(locals);
    const house = await getActiveHouse(user);
    if (!house) throw new AppError('No tenés una casa activa.', 409);

    const id = url.searchParams.get('id');
    if (!id) throw new AppError('Falta el id.');
    await deleteFixedCost(house.id, user.username, id);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
