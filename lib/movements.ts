import { sql } from './db';
import { computeBalance, type Balance } from './balance';

export interface Movement {
  id: number;
  store_id: number;
  date: string;
  concept: string;
  type: 'ingreso' | 'gasto';
  amount_usd: string;
  amount_ves: string;
  observacion: string;
}

export async function getMovementsBefore(storeId: number, date: string): Promise<Movement[]> {
  return (await sql.query(
    `select id, store_id, to_char(date, 'YYYY-MM-DD') as date, concept, type, amount_usd, amount_ves, observacion
     from movements where store_id = $1 and date < $2 order by date, created_at`,
    [storeId, date]
  )) as Movement[];
}

export async function getMovementsOnDate(storeId: number, date: string): Promise<Movement[]> {
  return (await sql.query(
    `select id, store_id, to_char(date, 'YYYY-MM-DD') as date, concept, type, amount_usd, amount_ves, observacion
     from movements where store_id = $1 and date = $2 order by created_at`,
    [storeId, date]
  )) as Movement[];
}

export async function getMovementsInRange(
  storeId: number,
  from: string,
  to: string
): Promise<Movement[]> {
  return (await sql.query(
    `select id, store_id, to_char(date, 'YYYY-MM-DD') as date, concept, type, amount_usd, amount_ves, observacion
     from movements where store_id = $1 and date >= $2 and date <= $3 order by date, created_at`,
    [storeId, from, to]
  )) as Movement[];
}

export async function getRangeLedger(
  storeId: number,
  from: string,
  to: string
): Promise<{ movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }> {
  const [before, inRange] = await Promise.all([
    getMovementsBefore(storeId, from),
    getMovementsInRange(storeId, from, to),
  ]);
  const saldoInicial = computeBalance(before);
  const rangeChange = computeBalance(inRange);
  const saldoFinal: Balance = {
    usdCents: saldoInicial.usdCents + rangeChange.usdCents,
    vesCents: saldoInicial.vesCents + rangeChange.vesCents,
  };
  return { movements: inRange, saldoInicial, saldoFinal };
}

export async function getDayLedger(
  storeId: number,
  date: string
): Promise<{ movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }> {
  const [before, onDate] = await Promise.all([
    getMovementsBefore(storeId, date),
    getMovementsOnDate(storeId, date),
  ]);
  const saldoInicial = computeBalance(before);
  const dayChange = computeBalance(onDate);
  const saldoFinal: Balance = {
    usdCents: saldoInicial.usdCents + dayChange.usdCents,
    vesCents: saldoInicial.vesCents + dayChange.vesCents,
  };
  return { movements: onDate, saldoInicial, saldoFinal };
}

export async function createMovement(input: {
  storeId: number;
  date: string;
  concept: string;
  type: 'ingreso' | 'gasto';
  amountUsd: number;
  amountVes: number;
  observacion: string;
}): Promise<void> {
  await sql.query(
    `insert into movements (store_id, date, concept, type, amount_usd, amount_ves, observacion)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.storeId,
      input.date,
      input.concept,
      input.type,
      input.amountUsd,
      input.amountVes,
      input.observacion,
    ]
  );
}

export async function getMovementDate(id: number): Promise<string | null> {
  const rows = (await sql.query(
    `select to_char(date, 'YYYY-MM-DD') as date from movements where id = $1`,
    [id]
  )) as { date: string }[];
  return rows[0]?.date ?? null;
}

export async function updateMovement(
  id: number,
  input: {
    date: string;
    concept: string;
    type: 'ingreso' | 'gasto';
    amountUsd: number;
    amountVes: number;
    observacion: string;
  }
): Promise<void> {
  await sql.query(
    `update movements
     set date = $2, concept = $3, type = $4, amount_usd = $5, amount_ves = $6, observacion = $7
     where id = $1`,
    [
      id,
      input.date,
      input.concept,
      input.type,
      input.amountUsd,
      input.amountVes,
      input.observacion,
    ]
  );
}

export async function deleteMovement(id: number): Promise<void> {
  await sql.query('delete from movements where id = $1', [id]);
}
