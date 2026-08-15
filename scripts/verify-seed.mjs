import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select slug, name from stores order by id');
console.log(rows);
if (rows.length !== 7) {
  throw new Error(`Expected 7 stores, found ${rows.length}`);
}
console.log('OK: 7 stores seeded.');
