import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = neon(process.env.DATABASE_URL);
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log('Executed:', statement.slice(0, 60).replace(/\s+/g, ' '));
}

console.log('Schema applied successfully.');
