import { sql } from './db';

export interface Store {
  id: number;
  slug: string;
  name: string;
}

export async function listStores(): Promise<Store[]> {
  return (await sql.query('select id, slug, name from stores order by name')) as unknown as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query('select id, slug, name from stores where slug = $1', [
    slug,
  ])) as unknown as Store[];
  return rows[0] ?? null;
}
