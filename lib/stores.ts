import { sql } from './db';

export interface Store {
  id: number;
  slug: string;
  name: string;
  telegram_chat_id: string | null;
  pin: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
}

export async function listStores(): Promise<Store[]> {
  return (await sql.query(
    'select id, slug, name, telegram_chat_id, pin, pin_failed_attempts, pin_locked_until from stores order by name'
  )) as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query(
    'select id, slug, name, telegram_chat_id, pin, pin_failed_attempts, pin_locked_until from stores where slug = $1',
    [slug]
  )) as Store[];
  return rows[0] ?? null;
}
