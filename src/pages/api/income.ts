import type { APIRoute } from 'astro';
import { AppError, addIncome, deleteIncome, getActiveHouse, updateIncome } from '../../lib/db';
import { errorResponse, json, parseAmount, readJson, requireUser } from '../../lib/http';
import type { IncomeType } from '../../lib/types';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const house = await getActiveHouse(user);
    if (!house) throw new AppError('No tenés una casa activa.', 409);

    const body = await readJson(request);
    const income = await addIncome(house.id, user.username, {
      description: String(body.description ?? '').trim(),
      amount: parseAmount(body.amount),
      type: String(body.type ?? 'sueldo') as IncomeType,
      person: String(body.person ?? '').trim(),
      date: String(body.date ?? '').trim(),
    });
    return json({ income });
  } catch (err) {
    return errorResponse(err);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = requireUser(locals);
    const house = await getActiveHouse(user);
    if (!house) throw new AppError('No tenés una casa activa.', 409);

    const body = await readJson(request);
    const id = String(body.id ?? '').trim();
    if (!id) throw new AppError('Falta el id.');
    const income = await updateIncome(house.id, user.username, id, {
      description: String(body.description ?? '').trim(),
      amount: parseAmount(body.amount),
      type: String(body.type ?? 'sueldo') as IncomeType,
      person: String(body.person ?? '').trim(),
      date: String(body.date ?? '').trim(),
    });
    return json({ income });
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
    await deleteIncome(house.id, user.username, id);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
